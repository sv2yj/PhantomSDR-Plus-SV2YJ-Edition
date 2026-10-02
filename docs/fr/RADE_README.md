# Voix numérique RADE v1 pour PhantomSDR-Plus

**RADE** (Radio AutoencoDEr) est le mode phare de voix numérique HF de FreeDV. Il utilise un hybride apprentissage automatique / DSP (le vocodeur neuronal FARGAN) pour offrir une parole de haute qualité en HF avec des SNR descendant jusqu'à −2 dB, dans seulement 1500 Hz de largeur de bande RF — plus étroit qu'un signal BLU.

Ce document couvre l'intégration complète de la réception RADE v1 dans PhantomSDR-Plus, mise en œuvre sous la forme d'un sidecar Python (`rade_helper.py`) qui relie le navigateur à la chaîne de décodage `radae_rxe.py` + `lpcnet_demo`.

## L'installation — la voie courte

```bash
cd ~/PhantomSDR-Plus
./install_rade.sh
```

C'est toute l'installation. Le script installe les paquets système avec le gestionnaire de paquets présent sur la machine (apt, pacman, dnf ou zypper), se rabat sur pip pour ce qu'une distribution ne fournit pas, met à jour `websockets` si la version de la distribution est antérieure à la 11.0 exigée par le sidecar, clone et compile radae, vérifie les poids du modèle, reconstruit le frontend et démarre le sidecar. Sous Ubuntu 22.04, il passe la main à `install_rade_ubuntu22.sh`. `./install.sh` propose de l'exécuter dans le cadre de l'installation normale : sur une machine neuve, RADE est donc déjà là.

**Ce document explique comment RADE fonctionne et comment le faire tourner — ce n'est pas la procédure d'installation.** Si vous devez installer à la main, sur un système que le script ne couvre pas ou pour réparer une étape, suivez le guide lié ci-dessous : les étapes y sont écrites, et nulle part ailleurs. Tout ce qui suit ici — l'architecture, les fichiers corrigés, le port, l'usage de RADE dans le navigateur, les variables d'environnement, le dépannage et la mesure de la simultanéité — vaut pour toute installation, quelle qu'en soit la manière.

- **[Installation manuelle sous Linux](RADE_General_INSTALL_MANUAL_LINUX.md)** - la voie manuelle, étape par étape, pour Ubuntu, Debian, Fedora, Arch et Raspberry Pi OS

---

## Table des matières

1. [L'installation — la voie courte](#linstallation--la-voie-courte)
2. [Fonctionnement](#fonctionnement)
3. [Vue d'ensemble de l'architecture](#vue-densemble-de-larchitecture)
4. [RADEL contre RADEU](#radel-contre-radeu)
5. [Prérequis](#prérequis)
6. [Installation à la main](#installation-à-la-main)
7. [Déployer les fichiers corrigés](#déployer-les-fichiers-corrigés)
8. [Contrôle du sidecar](#contrôle-du-sidecar)
9. [Le port 8074](#le-port-8074)
10. [Utiliser RADE dans le navigateur](#utiliser-rade-dans-le-navigateur)
11. [Vérification et débogage](#vérification-et-débogage)
12. [Variables d'environnement](#variables-denvironnement)
13. [Fichiers modifiés](#fichiers-modifiés)
14. [Résumé du flux du signal](#résumé-du-flux-du-signal)
15. [Dépannage](#dépannage)
16. [Mesurer la simultanéité sur votre propre matériel](#mesurer-la-simultanéité-sur-votre-propre-matériel)
17. [Mettre RADE v1 à jour](#mettre-rade-v1-à-jour)

---

## Fonctionnement

RADE v1 ne peut pas s'exécuter dans le navigateur — il exige PyTorch et le vocodeur neuronal FARGAN, trop volumineux pour WASM. La solution est un processus sidecar Python (`rade_helper.py`) qui s'exécute sur le même serveur que PhantomSDR-Plus.

> **Important :** `freedv_rx` du dépôt codec2 ne prend **pas** en charge RADEV1. La chaîne de décodage RADE réside entièrement dans le dépôt distinct `radae` de David Rowe (VK5DGR). N'essayez pas d'utiliser `freedv_rx` de codec2 pour RADE.

Lorsque vous sélectionnez RADE dans le navigateur :

1. Le frontend règle la démodulation sous-jacente sur USB ou LSB — le serveur C++ démodule le signal BLU normalement.
2. Le PCM démodulé brut est prélevé dans `audio.js` **avant** toute coupure ou porte de squelch — `radae_rxe.py` a besoin d'une entrée continue pour maintenir la synchronisation de trame.
3. Chaque bloc PCM est complété par des zéros pour passer de f32 réel à f32 complexe (réel + 0.0 imaginaire) — c'est ce que `radae_rxe.py` attend sur son entrée standard.
4. Le sidecar transmet ces échantillons à `radae_rxe.py`, qui produit des paramètres de vocodeur.
5. `lpcnet_demo -fargan-synthesis` convertit ces paramètres en parole s16 à 16000 Hz.
6. Le sidecar convertit s16 → f32 et renvoie le résultat au navigateur sous forme de trames WebSocket binaires.
7. Le navigateur restitue la parole décodée via l'API Web Audio à 16000 Hz.

Le serveur C++ (`spectrumserver.cpp`) n'est absolument pas modifié.

---

## Vue d'ensemble de l'architecture

```
┌────────────────────────────────────────────────────────────────────┐
│  Browser                                                           │
│                                                                    │
│  Decoder → "RADE v1 — RADEL (LSB)" / "RADEU (USB)"               │
│       │                                                            │
│  audio.js ── demod cmd (LSB/USB) ──────────► C++ spectrumserver   │
│       │                                              │             │
│       │  raw SSB PCM @ audioOutputSps ◄─────────────┘             │
│       │  (tapped before mute gate, zero-padded to complex f32)     │
│       │                                                            │
│       │  binary WebSocket ──► ws://host:8074                       │
│       ▼                                                            │
├────────────────────────────────────────────────────────────────────┤
│  rade_helper.py  (port 8074)                                       │
│                                                                    │
│  resample to 8000 Hz if needed                                     │
│  zero-pad real f32 → complex f32 pairs                             │
│       │ stdin pipe                                                  │
│       ▼                                                            │
│  radae_rxe.py  --model_name model19_check3/.../checkpoint_100.pth  │
│       │ stdout pipe (vocoder features f32)                         │
│       ▼                                                            │
│  lpcnet_demo  -fargan-synthesis  -  -                              │
│       │ stdout (s16 PCM @ 16000 Hz)                                │
│       │ converted → f32 by sidecar                                 │
│       │ binary WebSocket frames ──► browser                        │
│       ▼                                                            │
├────────────────────────────────────────────────────────────────────┤
│  Browser                                                           │
│                                                                    │
│  _radePlayPCM() → AudioContext.createBuffer(16000 Hz) → speaker   │
└────────────────────────────────────────────────────────────────────┘
```

---

## RADEL contre RADEU

RADE v1 est toujours transmis en BLU. Par convention :

| Mode  | Bande latérale | À utiliser sur les bandes                |
|-------|----------------|------------------------------------------|
| RADEL | LSB            | 160 m, 80 m, 40 m  (≤ 10 MHz)           |
| RADEU | USB            | 20 m, 17 m, 15 m, 12 m, 10 m (> 10 MHz) |

---

## Prérequis

| Élément requis | Version | Remarques |
|---|---|---|
| PhantomSDR-Plus | quelconque | avec le frontend Vite/Svelte |
| Linux | Ubuntu 24.04+ / Debian Bookworm+ | testé |
| Python | 3.8+ | pour `rade_helper.py` et `radae_rxe.py` |
| dépôt radae | dernier master | fournit `radae_rxe.py` et `lpcnet_demo` |
| cmake | 3.10+ | pour compiler `lpcnet_demo` depuis radae |
| PyTorch | 2.0+ | requis par `radae_rxe.py` |
| Node.js | 16+ | pour `npm run build` |
| websockets (Python) | 10–16+ | `pip3 install websockets` — toutes versions prises en charge |
| matplotlib | quelconque | requis par `radae_rxe.py` à l'importation |
| numpy | 1.23+ | requis ; permet aussi le rééchantillonnage |
| scipy | quelconque | facultatif, permet un rééchantillonnage précis |

---

## Installation à la main

`./install_rade.sh` réalise toute l'installation. Si vous voulez la faire vous-même — sur un système que le script ne couvre pas, ou pour réparer une étape — la procédure se trouve dans le **[Guide d'installation manuelle de RADE v1](RADE_General_INSTALL_MANUAL_LINUX.md)**, et là uniquement. Il couvre Ubuntu, Debian, Fedora, Arch et Raspberry Pi OS en une seule passe :

| | |
|---|---|
| Étape 1 | Paquets système, et la vérification de Node.js 22+ |
| Étape 2 | Paquets Python, avec l'option PEP 668 et la roue torch CPU seule |
| Étape 3 | Cloner et compiler le dépôt radae, vérifier `lpcnet_demo` et les poids du modèle |
| Étape 4 | Vérifier la chaîne de décodage hors ligne, avant de la relier au navigateur |
| Étape 5 | Compiler le frontend de PhantomSDR-Plus |
| Étape 6 | Contrôle du sidecar |
| Étape 7 | Ouvrir le port 8074 |
| Étapes 8 à 10 | Démarrer le serveur, vérifier RADE, l'utiliser dans le navigateur |

La suite de ce document suppose cela fait.

---

## Déployer les fichiers corrigés

Copiez les fichiers suivants du jeu de correctifs dans votre dépôt PhantomSDR-Plus.

### Nouveau fichier — à placer à la racine du dépôt, à côté du script de démarrage que vous utilisez :

```
rade_helper.py
```

### Fichiers frontend corrigés — à placer dans `frontend/src/` :

```
audio.js
App.svelte
```

### Ce que font les correctifs

**`audio.js`** — 5 modifications :
- Constructeur : 5 nouveaux champs d'état RADE (`decodeRADE`, `_radeSideband`, `_radeSocket`, `_radeCallback`, `_radeReady`, `_radeNextTime`)
- Sauvegarde du PCM avant amplification : `pcmArrayPreBoost` enregistré avant le gain FLAC de 300×, afin que RADE reçoive l'amplitude d'origine (l'amplification saturerait `radae_rxe.py`)
- `playAudio()` : prélèvement du PCM pour RADE en utilisant l'audio avant amplification, en amont de la porte de coupure/squelch
- `playAudio()` : garde `if (this.decodeRADE) return` — supprime la lecture BLU brute pendant que la parole décodée par RADE est jouée
- Nouvelles méthodes : `setRADEDecoding()`, `setRADECallback()`, `_radePlayPCM()` avec lecture planifiée sans blanc grâce à l'horloge `_radeNextTime` (lecture à **16000 Hz** — le débit de sortie de `lpcnet_demo`)

**Chaque variante Svelte** — 6 modifications :
- `demodulationDefaults` : RADEL `{type:'LSB', offsets:[2200,-700]}`, RADEU `{type:'USB', offsets:[-700,2200]}` — la bande passante commence à 700 Hz de la porteuse, sur 1500 Hz de large
- Variables d'état : `radeEnabled`, `radeConnected`, `radeSynced`, `radeSnr`, `_radeDeactivate()`
- `_radeDeactivate()` : arrête le décodeur et **restaure le mode par défaut de la bande** d'après `bands-config.js` — comportement identique à la désactivation de FAX, NAVTEX, FSK
- `_deactivateAll()` : ligne de nettoyage RADE
- `activateSelectedDecoder()` : branches `radel` et `radeu`
- Menu déroulant des décodeurs : deux nouvelles entrées `<option>`
- Panneau d'état : point de connexion, état de synchronisation/SNR, bannière d'erreur

### Scripts de démarrage

Les lanceurs du récepteur (`start-rx888mk2.sh`, `start-airspyhf.sh`, `start-rtl.sh`, `start-rsp1a.sh`, `start-fobos-hf.sh`, `start-fobos.sh`, `start-hackrf.sh`) démarrent eux-mêmes le sidecar dès que le serveur tourne, et `stop-websdr.sh` l'arrête avec le serveur. `rade.sh` reste destiné à faire tourner le sidecar de façon autonome — voir [Contrôle du sidecar](#contrôle-du-sidecar).

---

## Contrôle du sidecar

**Vous n'avez normalement pas besoin d'un script de contrôle distinct pour RADE.** Les lanceurs du récepteur (`start-rx888mk2.sh`, `start-airspyhf.sh`, `start-rtl.sh`, `start-rsp1a.sh`, `start-fobos-hf.sh`, `start-fobos.sh`, `start-hackrf.sh`) démarrent eux-mêmes le sidecar dès que le serveur est confirmé en marche, le relancent s'il s'arrête et signalent son état dans leur résumé de fin — `✔ RADE sidecar running`, ou une note `·` expliquant pourquoi il n'a pas été activé (non installé, `RADE_ENABLED=0`, ou pas de `python3`). `./stop-websdr.sh` l'arrête en même temps que le serveur. Pour faire tourner le serveur sans RADE, démarrez-le avec `RADE_ENABLED=0`.

`rade.sh` reste fourni pour un usage autonome — faire tourner le sidecar sans le lanceur PhantomSDR-Plus, ou le tester seul :

```bash
chmod +x ~/PhantomSDR-Plus/rade.sh
cd ~/PhantomSDR-Plus
./rade.sh start      # start sidecar with self-restarting watchdog
./rade.sh stop       # stop sidecar + watchdog + all lpcnet_demo children
./rade.sh restart    # stop then start cleanly
./rade.sh status     # show running / stopped + process info
```

L'activité du sidecar est journalisée dans `~/PhantomSDR-Plus/rade.log` :

```bash
tail -f ~/PhantomSDR-Plus/rade.log
```

> **Ne mélangez pas les deux pendant que le serveur tourne.** Si le chien de garde d'un lanceur est actif, il ramène le sidecar en cinq secondes environ, si bien que `./rade.sh stop` semble avoir échoué. Pour arrêter RADE alors que le serveur tourne, démarrez le serveur avec `RADE_ENABLED=0`, ou arrêtez tout avec `./stop-websdr.sh`.

> Si vous lancez `rade.sh` de façon autonome, **utilisez toujours `./rade.sh stop`** — un simple `pkill -f rade_helper.py` ne bat pas son propre chien de garde, qui relance le processus en 3 secondes.

---

## Le port 8074

Le sidecar écoute sur le port TCP **8074** et le navigateur s'y connecte directement : le port doit donc être joignable de l'extérieur. Son ouverture — ufw, firewalld, iptables, la règle NAT du routeur, et le proxy Nginx quand un FAI bloque purement et simplement le port — constitue l'[étape 7 du guide manuel](RADE_General_INSTALL_MANUAL_LINUX.md).

Deux choses méritent d'être répétées ici, car ce sont elles qui coûtent le plus de temps :

```bash
# Is the sidecar listening?
ss -tlnp | grep 8074
```

> **Attention au NAT hairpin :** un test avec `curl` depuis le serveur vers son propre nom public renvoie souvent `Connection refused` alors même que le port est ouvert — beaucoup de routeurs ne renvoient pas le trafic. Testez toujours depuis une machine extérieure, ou utilisez **https://portchecker.co**.

---

## Utiliser RADE dans le navigateur

1. Ouvrez votre interface web PhantomSDR-Plus
2. Trouvez les stations actives sur **[qso.freedv.org](https://qso.freedv.org)**
3. Accordez-vous sur la fréquence affichée de la station
4. Dans **Decoder Options**, sélectionnez :
   - **RADE v1 — RADEL (LSB)** pour 40 m / 80 m / 160 m
   - **RADE v1 — RADEU (USB)** pour 20 m / 17 m / 15 m / 12 m / 10 m
5. Cliquez sur **Decoder: ON**

### Les boutons RADEL / RADEU (une pression)

Les étapes 4 et 5 peuvent être remplacées par une seule pression. Une paire de boutons **RADEL** / **RADEU** est disponible à trois endroits :

- à côté du titre **Modes selector** du panneau principal ;
- dans la fenêtre **Modes** ;
- dans la fenêtre **Bands**.

Une pression sélectionne le décodeur, met le décodeur sur ON, ferme la fenêtre depuis laquelle vous avez appuyé et amène le panneau RADE à l'écran. Le bouton devient bleu tant que RADE tourne. **Appuyez de nouveau sur le même bouton pour arrêter RADE** — le panneau se ferme, et le mode ainsi que la bande passante reviennent à leur valeur par défaut comme décrit plus bas. Les boutons, le menu déroulant **Decoder Options** et le bouton ON/OFF partagent le même état.

### États de l'indicateur du panneau

| Indicateur | Signification |
|---|---|
| 🔴 Rouge — « Connecting to sidecar… » | Port 8074 injoignable ou sidecar arrêté |
| 🟡 Jaune — « Searching for signal… » | Sidecar connecté, aucune trame RADE encore détectée |
| 🟢 Vert — « Synced · SNR x.x dB » | Décodage en cours — la parole est audible |

### Quand vous désactivez le décodeur

Le mode et la bande passante reviennent automatiquement à la valeur par défaut correcte pour la fréquence courante, telle que définie dans `bands-config.js` — comme pour FAX, NAVTEX, FSK.

---

## Vérification et débogage

### Le sidecar tourne-t-il ?

```bash
ps aux | grep rade_helper | grep -v grep
ss -tlnp | grep 8074
```

### Suivre l'activité en direct

```bash
tail -f ~/PhantomSDR-Plus/rade.log
```

Lorsqu'un navigateur se connecte :
```
[RADE] client connected: x.x.x.x:XXXXX
[RADE] x.x.x.x:XXXXX  sps=12000 sideband=LSB
[RADE] x.x.x.x:XXXXX spawning pipeline (torch_threads=1)
```

### Test rapide du WebSocket

```bash
python3 - << 'EOF'
import asyncio, websockets, json

async def test():
    async with websockets.connect('ws://localhost:8074') as ws:
        await ws.send(json.dumps({'type': 'init', 'sps': 8000, 'sideband': 'LSB'}))
        print(await ws.recv())   # expect: {"type": "status", "connected": true}

asyncio.run(test())
EOF
```

### Console du navigateur (F12)

```
[RADE] ▶ ENABLED LSB @ 12000 Hz → helper ws://localhost:8074
```
Bon signe — le WebSocket est ouvert. La valeur en Hz correspond à l'`audioOutputSps` de votre serveur (typiquement 8000–12000 Hz).

```
[RADE] sidecar socket error
```
Le port 8074 est injoignable — vérifiez le pare-feu et la règle NAT du routeur.

---

## Variables d'environnement

| Variable | Défaut | Description |
|---|---|---|
| `RADE_HELPER_PORT` | `8074` | Port TCP sur lequel le sidecar écoute |
| `RADE_HELPER_HOST` | `0.0.0.0` | Adresse de liaison (`127.0.0.1` derrière un proxy) |
| `RADAE_DIR` | `~/radae` | Racine du dépôt radae |
| `RADE_MODEL` | `RADAE_DIR/model19_check3/checkpoints/checkpoint_epoch_100.pth` | Poids du modèle |
| `LPCNET_DEMO` | `RADAE_DIR/build/src/lpcnet_demo` | Binaire lpcnet_demo |
| `RADE_AUXDATA` | `1` | Mettre à `0` pour passer `--noauxdata` à `radae_rxe.py` |
| `RADE_TORCH_THREADS` | `1` | Threads PyTorch/OpenBLAS par instance de `radae_rxe.py` — limite l'usage CPU |
| `RADE_PIN_CORES` | `1` | Épingle chaque chaîne de décodage sur son propre jeu de cœurs ; `0` désactive l'épinglage |
| `RADE_CORES_PER_CLIENT` | `2` | Cœurs alloués par client lorsque l'épinglage est activé |

---

## Fichiers modifiés

| Fichier | Type | Remarques |
|---|---|---|
| `rade_helper.py` | **Nouveau** | Sidecar Python : serveur WebSocket + chaîne de décodage à deux processus |
| `frontend/src/audio.js` | Modifié | 4 correctifs |
| `frontend/src/App.svelte` | Modifié | 6 correctifs |
| `rade.sh` | **Nouveau** | Script de contrôle du sidecar RADE pour un usage autonome (start/stop/restart/status) |
| `start-rx888mk2.sh` | Modifié | démarre, surveille et signale le sidecar ; idem pour `start-airspyhf.sh`, `start-rtl.sh`, `start-rsp1a.sh`, `start-fobos-hf.sh`, `start-fobos.sh`, `start-hackrf.sh` |
| `stop-websdr.sh` | Modifié | arrête le sidecar en même temps que le serveur |
| `spectrumserver.cpp` | **Inchangé** | Aucune modification C++ nécessaire |

---

## Résumé du flux du signal

```
Antenna → RX-888 MK2 → PhantomSDR-Plus C++ server
                              │
                    FFT + DDC + SSB demodulation
                    (USB or LSB — set by RADEL/RADEU)
                              │
                    Opus/FLAC encode → WebSocket → Browser
                              │
                         audio.js decode()
                              │
                         playAudio(pcmArray)
                              │
               ┌──────────────┴────────────────────────────┐
               │  rawPcm tap (before mute gate)             │
               │  real f32 → zero-padded complex f32 pairs  │
               └──────────────┬────────────────────────────┘
                              │ WebSocket binary → ws://host:8074
                              ▼
                       rade_helper.py
                              │ resample to 8000 Hz if needed
                              │ stdin pipe
                              ▼
          radae_rxe.py  --model_name model19_check3/.../checkpoint_epoch_100.pth
          (PyTorch FARGAN neural vocoder, auxdata ON by default)
                              │ stdout pipe (vocoder features f32)
                              ▼
          lpcnet_demo  -fargan-synthesis  -  -
                              │ stdout: s16 PCM @ 16000 Hz
                              │ sidecar converts s16 → f32
                              │ WebSocket binary frames → browser
                              ▼
                  audio.js  _radePlayPCM()
                  AudioContext.createBuffer(16000 Hz)
                              │
                           Speaker 🔊
```

---

## Dépannage

### Bannière rouge — « Sidecar not reachable »

```bash
# Is sidecar running?
ps aux | grep rade_helper | grep -v grep

# Start it manually for testing
python3 ~/PhantomSDR-Plus/rade_helper.py &

# Check port is open externally — use portchecker.co NOT curl from the server
# (curl from the server uses NAT loopback and gives false "Connection refused")
```

---

### Port 8074 fermé sur portchecker.co malgré la règle iptables

Le FAI filtre peut-être le port, ou la règle NAT du routeur est absente. Options :

1. Essayer un autre port : `RADE_HELPER_PORT=8080 python3 rade_helper.py`
2. Passer par votre port public existant via un proxy Nginx (voir l'[étape 7 du guide manuel](RADE_General_INSTALL_MANUAL_LINUX.md))

---

### `radae_rxe.py: error: unrecognized arguments: model_path`

Le chemin du modèle doit être passé avec `--model_name`, pas en argument positionnel :

```bash
# WRONG — positional argument
python3 radae_rxe.py model19_check3/checkpoints/checkpoint_epoch_100.pth

# CORRECT — named argument
python3 radae_rxe.py --model_name model19_check3/checkpoints/checkpoint_epoch_100.pth
```

---

### `ModuleNotFoundError: No module named 'matplotlib'`

```bash
pip3 install matplotlib
```

`radae_rxe.py` importe matplotlib sans condition en tête de fichier.

---

### `ModuleNotFoundError: No module named 'torch'`

```bash
pip3 install torch
```

---

### `lpcnet_demo: No such file or directory`

La compilation de radae n'a pas abouti. Recompilez :

```bash
cd ~/radae/build
cmake .. && make -j$(nproc)
ls src/lpcnet_demo     # should exist now
```

---

### Erreur `size mismatch` dans `inference.sh`

`model19_check3` exige `--auxdata` lors de l'encodage avec `inference.sh` :

```bash
./inference.sh model19_check3/checkpoints/checkpoint_epoch_100.pth \
    wav/brian_g8sez.wav /dev/null \
    --rate_Fs --pilots --pilot_eq --eq_ls --cp 0.004 \
    --write_rx rx.f32 --auxdata    # ← required for model19_check3
```

À noter : lors du **décodage** avec `radae_rxe.py`, `--auxdata` est la valeur par défaut — ne le passez pas.

---

### Indicateur jaune — « Searching for signal » — ne se synchronise jamais

- Confirmez la bonne bande latérale : RADEL pour ≤ 10 MHz, RADEU pour > 10 MHz
- Consultez [qso.freedv.org](https://qso.freedv.org) pour vérifier qu'une station émet actuellement
- RADE v1 utilise 30 porteuses dans 1500 Hz de bande — il apparaît comme un groupe compact dans la cascade
- Comptez jusqu'à 1,5 seconde pour l'acquisition

---

### `underrun!!!` d'aplay pendant le test de la chaîne (étape 3)

Attendu uniquement lors des tests hors ligne sur fichier. `radae_rxe.py` traite plus lentement que les entrées/sorties du fichier, ce qui affame le tampon audio. Cela ne se produit pas en réception en direct, car le navigateur fournit l'audio au rythme temps réel.

---

### `ConnectionClosedError: received 1011 (internal error)`

Le sidecar a accepté la connexion WebSocket mais a planté en interne avant de répondre. La cause est une version incompatible de `rade_helper.py` — une version plus ancienne tentait de passer un `StreamReader` asyncio comme entrée standard d'un sous-processus, ce qui échoue silencieusement et ferme avec l'erreur 1011.

**Correctif :** remplacez `rade_helper.py` par la version actuelle du jeu de correctifs. La version actuelle utilise `os.pipe()` pour le tube interprocessus et est compatible avec websockets 10.x à 16.x+.

---

### Plusieurs utilisateurs simultanés

Chaque connexion de navigateur lance sa propre paire indépendante `radae_rxe.py` + `lpcnet_demo`, de sorte que chaque utilisateur peut s'accorder librement sur une fréquence différente.

Par défaut, `radae_rxe.py` utilise **tous les cœurs CPU disponibles** pour les opérations matricielles PyTorch, ce qui provoque une charge d'environ 900 % par instance. `rade_helper.py` limite cela avec deux optimisations :

1. `OMP_NUM_THREADS=1` (et les équivalents MKL/OpenBLAS) — limite PyTorch à 1 thread
2. Fonctions de conversion audio vectorisées avec numpy — éliminent le coût des boucles Python

Résultat : chaque instance consomme environ **8 à 10 %** d'un cœur, suffisant pour un décodage RADE en temps réel. Si vous entendez des coupures audio, passez à 2 threads :

```bash
RADE_TORCH_THREADS=2 ./start-rx888mk2.sh     # or your receiver's launcher
# standalone: RADE_TORCH_THREADS=2 ./rade.sh restart
```

| Utilisateurs RADE simultanés | CPU approximatif |
|---|---|
| 1 | ~9 % |
| 5 | ~45 % |
| 10 | ~90 % |
| 20 | ~180 % |

Sur un i5-12450H (12 threads) avec spectrumserver à ~42 % et rx888_stream à ~11 %, vous disposez d'environ **1000 % de marge** — assez pour **20 utilisateurs RADE simultanés ou plus** avant que le CPU ne devienne un souci.

> **Le tableau ci-dessus suppose que le coût CPU croît linéairement avec le nombre d'utilisateurs. La mesure dit le contraire.** Une exécution de `rade_loadtest.py` sur ce même i5-12450H a montré un coût CPU par auditeur bien inférieur à ce tableau jusqu'à ~24 auditeurs, puis une hausse marquée au-delà, la machine étant arrêtée par la **température du package à 32 auditeurs** — ni par le CPU, ni par la bande passante. Considérez ces chiffres comme un repère grossier pour de petits nombres seulement et mesurez votre propre machine : voir [Mesurer la simultanéité sur votre propre matériel](#mesurer-la-simultanéité-sur-votre-propre-matériel). Notez que le test de charge alimente la chaîne avec du bruit plutôt qu'un vrai signal RADE : la charge CPU absolue avec du trafic réel peut donc différer ; c'est la *forme* de la courbe qui est fiable.

---

## Mesurer la simultanéité sur votre propre matériel

Les chiffres ci-dessus proviennent d'une machine précise. `rade_loadtest.py` (à la racine du dépôt) mesure la même chose sur **la vôtre** — il monte en charge des auditeurs RADE synthétiques face au sidecar par paliers et indique le dernier nombre d'auditeurs que votre machine a soutenu avant que quelque chose ne cède.

Après chaque palier, il laisse la machine se stabiliser, puis échantillonne la température du package, le CPU total, la RAM disponible, le swap et la RSS combinée de tous les processus `radae_rxe.py` et `lpcnet_demo`. Il s'arrête au premier **coude** — quelle que soit la limite franchie en premier — et affiche le dernier nombre stable.

### Prérequis

```bash
sudo apt install python3-websockets python3-psutil
```

Exécutez-le **sur l'hôte SDR** (il lit les capteurs locaux et la mémoire des processus), avec spectrumserver et le sidecar RADE déjà en marche :

```bash
cd ~/PhantomSDR-Plus
python3 rade_loadtest.py
```

Ctrl-C ferme proprement toutes les connexions à tout moment.

### Avant la première exécution

Ouvrez le fichier et vérifiez les deux blocs en tête :

- **`CONFIG`** — `WS_URL` vaut par défaut `ws://127.0.0.1:8074` ; changez-le si vous avez déplacé le sidecar de son port par défaut. `RADE_SPS` (12000) et `RADE_SIDEBAND` (`USB`) doivent correspondre à ce que rapporte votre frontend.
- **`handshake_messages()`** — l'unique trame `init` envoyée doit correspondre à l'init RADE de `frontend/src/audio.js`. Si cette poignée de main a dérivé, chaque auditeur échoue à se connecter et le test se termine immédiatement par des échecs de connexion.

### Seuils du coude

Ajustez-les dans `CONFIG` à votre convenance — ils sont volontairement prudents :

| Seuil | Défaut | Arrête lorsque |
|---|---|---|
| `TEMP_KNEE_C` | `85.0` | La température du package atteint ce plafond |
| `MIN_AVAIL_MB` | `800` | La RAM disponible tombe en dessous |
| `SWAP_GROWTH_MB` | `50` | Le swap dépasse la référence prise au démarrage |
| `FAIL_LIMIT` | `3` | Autant d'auditeurs échouent à se connecter en un palier |
| `MAX_LISTENERS` | `60` | Arrêt ferme même si aucun coude n'est atteint |

La forme de la montée est contrôlée par `STEP` (auditeurs ajoutés par palier, 2 par défaut), `SETTLE_S` (25 s de stabilisation avant échantillonnage — c'est ce qui laisse la chaleur s'accumuler) et `SAMPLE_S` (fenêtre de moyennage CPU de 5 s). Une exécution complète jusqu'au plafond par défaut de 60 auditeurs prend donc environ 15 minutes.

### Lire les résultats

Chaque palier affiche une ligne et ajoute une ligne à `rade_loadtest.csv` :

| Colonne | Signification |
|---|---|
| `listeners` | Auditeurs synthétiques connectés à ce palier |
| `connect_fails` | Auditeurs n'ayant pas réussi à établir ou maintenir une connexion |
| `pkg_c` | Température du package, médiane de 5 échantillons (résistante aux pics) |
| `cpu_pct` | Pourcentage CPU **de tout le système**, pas par auditeur |
| `avail_mb` | RAM disponible |
| `swap_mb` | Swap utilisé |
| `dec_rss_mb` | RSS combinée de tous les processus de décodage |
| `dec_procs` | Nombre de processus de décodage — attendez-vous à **2 par auditeur** (`radae_rxe.py` + `lpcnet_demo`) |

#### Une exécution mesurée

Sur l'i5-12450H mentionné plus haut, une exécution complète s'est terminée ainsi :

```
KNEE at n=32: temp 91.0°C ≥ 85.0
Last stable concurrency: 30 RADE listeners
```

**La chaleur était la contrainte déterminante**, et de loin. Au coude, il restait encore 7004 Mo de RAM disponible — 6,2 Go au-dessus du seuil `MIN_AVAIL_MB` — et zéro échec de connexion à chaque palier.

Deux colonnes méritent une lecture attentive :

**`dec_rss_mb` surestime le coût mémoire réel.** Elle croît de façon très régulière de 295 Mo par auditeur (292, 294, 294 … 295 sur les 16 paliers), mais la *RAM disponible* ne baisse que d'environ **202 Mo par auditeur**. Les deux processus derrière chaque auditeur partagent des pages de bibliothèques, et la RSS compte ces pages une fois par processus. En extrapolant la pente de `avail_mb`, le coude mémoire arriverait vers **63 auditeurs** — au-delà de l'arrêt ferme à 60 auditeurs, il ne peut donc jamais se déclencher sur cette machine. Dimensionnez la mémoire d'après `avail_mb`, pas d'après `dec_rss_mb`.

**`cpu_pct` est plat, puis ne l'est plus.** Il reste à ~5,3 % de la machine entière jusqu'à 24 auditeurs, puis devient superlinéaire :

| Auditeurs | 24 | 26 | 28 | 30 | 32 |
|---|---|---|---|---|---|
| `cpu_pct` | 6,7 % | 18,4 % | 30,1 % | 49,6 % | 65,2 % |

Soit une hausse de 10× du CPU alors que le nombre d'auditeurs augmente d'un tiers. L'inflexion se reproduit au même endroit d'une exécution à l'autre : traitez-la comme une propriété de la machine et non comme du bruit — le coût CPU par auditeur avoisine 3,4 % d'un cœur sous l'inflexion et environ 20 % au-dessus. N'extrapolez pas un chiffre de CPU par utilisateur relevé à faible nombre d'auditeurs.

> **Le test n'a pas de coude CPU.** Les quatre limites sont la température, la RAM disponible, la croissance du swap et les échecs de connexion — le CPU est enregistré mais ne met jamais fin à l'exécution. Dans l'exécution ci-dessus, le CPU a atteint 65 % et aurait continué de grimper si la température n'avait pas cédé la première. Si un plafond CPU vous importe, surveillez la colonne vous-même ou ajoutez un seuil.

> **Ce que cela prouve et ne prouve pas.** Chaque auditeur synthétique diffuse du bruit aléatoire de faible amplitude, et non un vrai signal RADE. C'est suffisant pour faire fonctionner toute la chaîne de décodage et consommer des ressources : les chiffres de ressources sont donc significatifs — mais le test ne dit rien de la *qualité* du décodage ni de la continuité audio en charge. Confirmez cela avec de vrais auditeurs sur un vrai signal.

### Si les cœurs saturent avant le coude

RADE épingle fortement un thread par instance, si bien que des cœurs individuels peuvent atteindre ~90 °C alors que le CPU total semble au repos. `rade_helper.py` répartit les chaînes sur les cœurs à tour de rôle pour y remédier. Si une exécution montre des coudes thermiques précoces, élargissez l'allocation de cœurs par client :

```bash
RADE_CORES_PER_CLIENT=3 ./rade.sh restart
```

Aucune modification de fichier n'est nécessaire — il s'agit d'une variable d'environnement (voir [Variables d'environnement](#variables-denvironnement)) ; `RADE_PIN_CORES=0` désactive entièrement l'épinglage.

---

## Mettre RADE v1 à jour

L'intégration à PhantomSDR-Plus (`rade_helper.py`, correctifs du frontend) n'est qu'un pont — toute la logique de décodage RADE réside dans le dépôt `radae`. Les mises à jour se résument donc presque toujours à un simple `git pull` + recompilation, sans aucune modification de PhantomSDR-Plus lui-même.

### Mise à jour standard (nouveau code, même modèle)

```bash
# 1. Pull latest radae code
cd ~/radae
git pull

# 2. Rebuild lpcnet_demo (in case C code changed)
cd build
cmake ..
make -j$(nproc)

# 3. Restart the sidecar — no server restart needed
cd ~/PhantomSDR-Plus
./rade.sh restart
```

C'est tout. Pas de recompilation du frontend, pas de redémarrage du serveur, aucune modification de fichier.

### Nouveaux poids de modèle uniquement

Si un nouveau point de contrôle est publié (p. ex. `model20`) sans changement de code, pointez le sidecar vers les nouveaux poids via la variable d'environnement — aucune modification de fichier n'est nécessaire :

```bash
# One-off: start with new model
RADE_MODEL=~/radae/model20/checkpoints/checkpoint_epoch_100.pth ./rade.sh start

# Or permanently — add to your shell profile (~/.bashrc):
export RADE_MODEL=~/radae/model20/checkpoints/checkpoint_epoch_100.pth
```

### Ce que chaque type de changement exige

| Ce qui a changé dans radae | Action requise |
|---|---|
| Nouveaux poids de modèle (nouveau fichier `.pth`) | Définir la variable `RADE_MODEL`, `./rade.sh restart` |
| Changement de code dans `radae_rxe.py` | `git pull`, `./rade.sh restart` |
| Code C de `lpcnet_demo` modifié | `git pull`, recompiler, `./rade.sh restart` |
| `radae_rxe.py` renommé ou déplacé | Mettre à jour le chemin `RADAE_RX` dans `rade_helper.py` (une ligne) |
| Argument `--model_name` renommé | Mettre à jour `radae_cmd` dans `rade_helper.py` (une ligne) |
| Nouveau taux d'échantillonnage de sortie (≠ 16000 Hz) | Mettre à jour `SPS_OUT` dans `rade_helper.py` + `createBuffer()` dans `audio.js` |
| RADE v2 utilise un binaire différent | Mettre à jour `RADAE_RX` dans `rade_helper.py` (une ligne) |

### Vérifier que la mise à jour a fonctionné

Après le redémarrage, confirmez que le nouveau code s'exécute :

```bash
# Check sidecar picked up new radae_rxe.py
./rade.sh status

# Tail log to see startup lines
tail -20 ~/PhantomSDR-Plus/rade.log
```

Le journal doit afficher le chemin de modèle attendu :
```
[RADE] model : /home/sv1btl/radae/model19_check3/checkpoints/checkpoint_epoch_100.pth
```

### Rester à jour

Abonnez-vous à la page des versions du dépôt radae pour être averti des nouveaux modèles et mises à jour de code :

```
https://github.com/drowe67/radae/releases
```

Consultez le blog FreeDV pour les annonces concernant les nouvelles formes d'onde et modèles RADE :

```
https://freedv.org/blog/
```

---

*Développé et testé sur PhantomSDR-Plus (fork sv1btl/PhantomSDR-Plus) avec un RX-888 MK2 sous Ubuntu 24.04. Le serveur C++ n'est pas modifié.*

*RADE est développé par David Rowe VK5DGR et l'équipe FreeDV.* *Voir [freedv.org/radio-autoencoder](https://freedv.org/radio-autoencoder).*

---

### Désinstallation complète et réinstallation propre

Voici le démontage complet avant de relancer install_rade.sh :
1. Arrêter le sidecar cd ~/PhantomSDR-Plus && ./rade.sh stop
2. Supprimer le dépôt radae et sa compilation rm -rf ~/radae
3. Supprimer torch (installé dans le répertoire local de l'utilisateur) pip3 uninstall -y torch rm -rf ~/.local/lib/python3.11/site-packages/torch*
4. Supprimer les paquets Python d'apt (facultatif — à ignorer s'ils servent à autre chose) sudo apt-get remove -y python3-numpy python3-scipy python3-matplotlib python3-websockets sudo apt-get autoremove -y
5. Vérifier que tout a disparu python3 -c "import torch" 2>&1        # should say ModuleNotFoundError ls ~/radae 2>&1                        # should say No such file or directory
6. Installation propre chmod +x ~/PhantomSDR-Plus/install_rade.sh ~/PhantomSDR-Plus/install_rade.sh
