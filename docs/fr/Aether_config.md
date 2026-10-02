# Émulation des clients KiwiSDR

**Connecter AetherSDR, kiwiclient et les autres logiciels KiwiSDR à PhantomSDR-Plus**

Depuis la v4.1.0, PhantomSDR-Plus sait aussi répondre au **protocole KiwiSDR**, si bien qu'un logiciel écrit pour un KiwiSDR — **AetherSDR**, `kiwiclient` et les autres — se connecte directement à votre récepteur. C'est une passerelle interne au même processus serveur, sur le même hôte et le même port que vous publiez déjà : pas de second service, pas de second port, pas de mandataire.

**Elle est désactivée tant que vous ne l'activez pas.** Rien de la passerelle ne tourne — ni socket, ni vérification — tant que `[kiwi_emulation]` est absent ou à `false`, ce qui est l'état d'une arborescence fraîchement installée.

---

## Table des matières

1. [Ce que reçoit un client Kiwi](#1-ce-que-reçoit-un-client-kiwi)
2. [Installer la passerelle](#2-installer-la-passerelle)
3. [L'activer](#3-lactiver)
4. [Référence de configuration](#4-référence-de-configuration)
5. [Connecter un client](#5-connecter-un-client)
6. [Niveau audio](#6-niveau-audio)
7. [Le S-mètre](#7-le-s-mètre)
8. [Cascade et spectre](#8-cascade-et-spectre)
9. [Si quelque chose ne va pas](#9-si-quelque-chose-ne-va-pas)
10. [Jusqu'où cela a été vérifié](#10-jusquoù-cela-a-été-vérifié)

---

## 1. Ce que reçoit un client Kiwi

| | |
|---|---|
| **Audio** | `ws://<hôte>:<port>/kiwi/<id>/SND` — audio démodulé dans le format de trame SND propre au Kiwi |
| **Cascade** | `ws://<hôte>:<port>/kiwi/<id>/W/F` — le spectre, en trames W/F du Kiwi |
| **Accord** | réel, pas cosmétique : `SET mod=…` venant du client change la fréquence, la bande latérale et la bande passante côté PhantomSDR, exactement comme le ferait un auditeur au navigateur |
| **S-mètre** | alimenté par la puissance par bloc du démodulateur lui-même, sur la même échelle que le S-mètre web |

L'accord est pris en charge pour une entrée **réelle** (`signal = "real"` dans votre `.toml`). Pour une entrée IQ, la relation entre case et fréquence diffère et n'est pas implémentée : un récepteur IQ fournira donc l'audio et la cascade mais ne suivra pas l'accord d'un client Kiwi.

---

## 2. Installer la passerelle

La passerelle est un ensemble de correctifs aux sources du backend, plus un nouvel en-tête, `src/kiwi_bridge.h`. Il y a deux façons de les mettre en place.

**Avec l'installateur.** `install.sh` (ainsi que `install_arch.sh`, `install_fedora.sh`, `install_opensuse.sh`) ont une étape dédiée — l'étape 17, *Kiwi client emulation*. Elle est proposée, non imposée : répondez `n` et rien n'est modifié. Pour une exécution sans surveillance, `PHANTOM_KIWI=y|n` en décide, et la valeur par défaut est oui.

**Sur une arborescence déjà installée**, lancez le script livré à la racine du dépôt :

```bash
cd ~/PhantomSDR-Plus
./kiwi_install.sh
./recompile.sh          # choisir [1] Backend seul
```

`kiwi_install.sh` sauvegarde d'abord chaque fichier qu'il touche dans `backup_kiwi_bridge_<horodatage>/` et applique chaque correctif par correspondance exacte de texte — si une ancre n'est pas là où il l'attend (arborescence modifiée localement, autre version), il s'arrête aussitôt, nomme le fichier et le laisse intact. Il est idempotent : sur une arborescence qui possède déjà la passerelle, il signale chaque correctif comme déjà appliqué et ne change rien.

> **Si vous venez d'appliquer une archive de mise à jour qui contient déjà la passerelle, vous n'avez pas besoin de le lancer.** Les sources corrigées sont dans le paquet ; `kiwi_install.sh` vous dirait seulement que chaque correctif est déjà en place.

Les fichiers qu'il corrige sont `src/client.h`, `src/signal.cpp`, `src/waterfall.cpp`, `src/spectrumserver.h`, `src/spectrumserver.cpp`, `src/websocket.cpp` et `src/http.cpp`, et il copie `kiwi_bridge.h` dans `src/`.

> **Il installe la passerelle, il ne la met pas à jour.** Si un correctif *échoue* un jour sur une arborescence où la passerelle fonctionne déjà, c'est que le code a pris de l'avance sur le script — et c'est le script qu'il faut mettre à jour, pas votre arborescence.

---

## 3. L'activer

Ajoutez ceci au `.toml` avec lequel votre récepteur tourne réellement — le fichier que vous passez à `spectrumserver`, celui que nomme votre `start-<radio>.sh`. Pas `config.example.*` :

```toml
[kiwi_emulation]
enabled = true
```

Puis redémarrez le récepteur :

```bash
./stop-websdr.sh
./start-<votre-radio>.sh
```

`kiwi_install.sh` ajoute le bloc pour vous, avec `enabled = true`, à ceux qui existent parmi `config.toml`, `config-rx888mk2.toml`, `config-airspyhf.toml`, `config-rtl.toml`, `config-rsp1a.toml`, `config-fobos.toml`, `config-fobos-hf.toml` et `config-hackrf.toml` à la racine du dépôt. Il ne peut rien savoir d'une configuration que vous gardez ailleurs ou sous un autre nom, et **les archives de mise à jour ne livrent jamais de `.toml`** : après une mise à jour, le bloc est à vous d'ajouter à la main. Les `config.example.*.toml` livrés le portent, documenté et à `false`.

---

## 4. Référence de configuration

Tout ce que lit la passerelle tient dans une seule section `[kiwi_emulation]`. Seul `enabled` est obligatoire ; les quatre réglages fins ont tous pour défaut la valeur étalonnée, si bien qu'un bloc ne contenant que `enabled = true` est déjà correct.

| Clé | Défaut | Rôle |
|---|---|---|
| `enabled` | `false` | Répondre au protocole KiwiSDR. Désactivé = totalement inerte. |
| `audio_gain` | `0` | dB. Gain de sortie, pour les clients Kiwi seulement. Voir [Niveau audio](#6-niveau-audio). |
| `smeter_offset` | `input.analog_smeter_offset` | dB. Remplace le décalage du S-mètre, pour les clients Kiwi seulement. Voir [Le S-mètre](#7-le-s-mètre). |
| `wf_cal` | `0` | dB. Réglage d'affichage de la cascade et du spectre. Voir [Cascade et spectre](#8-cascade-et-spectre). |
| `wf_fps_max` | `23` | Images de cascade par seconde. Voir [Cascade et spectre](#8-cascade-et-spectre). |

Un bloc complet, avec les valeurs qu'utilise le récepteur de ce projet :

```toml
[kiwi_emulation]
enabled       = true
audio_gain    = 60.0    # dB, clients Kiwi seulement. 0 = intact.
wf_cal        = -10.0   # dB, affaire de goût. 0 = concorde avec le S-mètre.
wf_fps_max    = 28      # images/s. 23 est le maximum du protocole.
# smeter_offset = 5.0   # dB. Par défaut, input.analog_smeter_offset.
```

> **Toutes ces clés sont lues au démarrage.** En changer une est un **redémarrage**, pas une recompilation — `./stop-websdr.sh` puis votre script de démarrage. Vous n'avez jamais besoin de recompiler pour les régler.

Les formes entière et décimale sont acceptées indifféremment : `28` et `28.0` se lisent de la même façon. Seule une clé réellement absente retombe sur son défaut.

---

## 5. Connecter un client

Pointez le client sur la même adresse et le même port que vos auditeurs — pas de chemin, pas de préfixe. AetherSDR demande un hôte et un port ; `kiwiclient` prend `-s` et `-p` :

```bash
# kiwiclient, enregistrement de 30 secondes sur 7100 kHz LSB
python3 kiwirecorder.py -s votre.recepteur.example -p 8073 -f 7100 -m lsb --tlimit=30
```

Le client s'accorde, la cascade se remplit, le S-mètre indique. Si rien ne se passe du tout, la passerelle est presque à coup sûr encore désactivée — voir la [section 3](#3-lactiver).

---

## 6. Niveau audio

La première chose que l'on remarque, c'est qu'un client Kiwi sonne plus maigre que la page web de PhantomSDR. Ce n'est pas que la passerelle perde quoi que ce soit : un même tampon alimente tous les encodeurs, et la même fréquence avec la même bande passante, mesurée par le chemin audio du navigateur et par `/SND`, donne des échantillons identiques. La page web est forte parce qu'`audio.js` reconstruit le son dans le navigateur — accentuation des graves, passe-bande, relèvement de présence, un compresseur avec gain de compensation et le curseur de volume. Un client Kiwi n'a rien de tout cela et ne peut pas l'obtenir.

`audio_gain` comble l'écart, pour les clients Kiwi seulement :

```toml
[kiwi_emulation]
enabled    = true
audio_gain = 55.0       # dB, clients Kiwi seulement. 0 = intact.
```

**Commencez autour de 55–60 dB.** 55 dB n'est pas un calcul : c'est là qu'un client Kiwi et la page web de PhantomSDR ont été mesurés au même niveau, à l'écoute d'une forte station locale sur 729 kHz. En pratique on préfère souvent un peu plus — ce récepteur s'est arrêté à 60 — choisissez donc à l'oreille.

Vous ne pouvez pas abîmer l'audio avec cela. Un **limiteur de crête à anticipation** se place entre le gain et l'écrêtage 16 bits : chaque échantillon est retardé de 4 ms pendant que le gain est calculé sur de l'audio qui n'a pas encore été envoyé, si bien qu'un passage fort arrive sur un gain déjà redescendu pour lui, et les crêtes se replient au lieu d'être aplaties. Poussé à 60 et même 70 dB — bien au-delà de la marge dont dispose le gain seul — pas un échantillon sur un quart de million n'a été écrêté. Sous le seuil du limiteur, le gain vaut exactement 1,0 : un récepteur qui ne pousse pas l'audio reçoit donc les échantillons intacts.

Une valeur trop élevée coûte du volume, pas de la qualité. Au-delà d'environ 60 dB, le gain supplémentaire est simplement limité : mesuré ici, le niveau a monté d'environ 1 dB de 55 à 60 et n'a presque pas bougé de 60 à 70. Passé ce point, vous achetez de la compression, pas du volume.

Rien de tout cela ne touche à la page web, et rien ne déplace le S-mètre — celui-ci vient de la puissance du démodulateur, pas des échantillons audio : monter le volume ne peut donc pas faire mentir l'instrument.

---

## 7. Le S-mètre

Le S-mètre Kiwi n'est pas étalonné à part : il reproduit ce qu'affiche votre page web, étage par étage. La puissance par bloc du démodulateur est le point de départ des deux, puis la page applique `input.analog_smeter_offset`, dilate le résultat autour de −130 dBm et ajoute son propre décalage d'affichage. La passerelle fait de même, si bien qu'un client Kiwi et la page montrent le même signal à la même force — vérifié sur une forte station locale, où les deux indiquaient −37 dBm.

Si, et seulement si, vous voulez que les clients Kiwi affichent autre chose que votre page, donnez à la passerelle son propre décalage :

```toml
[kiwi_emulation]
enabled       = true
smeter_offset = 5.0     # remplace input.analog_smeter_offset pour les clients Kiwi seulement
```

> **Comparez les deux instruments avec le même filtre, ou pas du tout.** La lecture vient de la puissance dans la bande passante : un filtre plus large ramasse plus de bruit et indique plus haut — sur une bande calme, la même fréquence a mesuré 5,6 dB de plus à 9 kHz qu'à 2,4 kHz. Un client Kiwi avec un filtre de 6 kHz face à une page web à 2,4 kHz divergera de plusieurs dB quel que soit l'étalonnage. Accordez d'abord le mode et la largeur de bande.

> **C'est l'échelle de la page, pas une échelle physique.** L'instrument web dilate sa plage pour la lisibilité : 10 dB de variation réelle s'affichent comme environ 11. La reproduire signifie que les clients Kiwi s'accordent avec votre récepteur et s'écartent d'un vrai KiwiSDR d'une quantité qui croît avec la force du signal. C'est le bon compromis quand votre propre page est la référence à laquelle tout le monde se compare ; si vous préférez que la passerelle reste physiquement honnête, c'est cette section qu'il faut changer.

---

## 8. Cascade et spectre

### L'échelle en dB — `wf_cal`

Chaque case de la cascade est convertie en dBm réels avant d'être envoyée, sur l'échelle même à laquelle le S-mètre est étalonné. Une porteuse indique donc **le même niveau à tous les zooms**, ce que donne un vrai KiwiSDR, et le spectre concorde avec le S-mètre de la page web sur la même bande passante.

```toml
[kiwi_emulation]
enabled = true
wf_cal  = 0.0           # dB, clients Kiwi seulement
```

> **`wf_cal` n'est pas un étalonnage.** `0` est la valeur pour laquelle le spectre concorde avec votre S-mètre, et c'est là qu'il faut le laisser si vous voulez que les chiffres veuillent dire quelque chose. Il existe parce que la *force apparente* d'un spectre est affaire de goût et de ce que votre client fait de la plage — le récepteur de ce projet tourne à `-10` simplement parce que c'est ce qui rend bien dans AetherSDR. Une seule valeur déplace ensemble le spectre et la cascade : ce sont les mêmes octets sur le fil, et le protocole Kiwi ne peut pas les mettre à l'échelle séparément. Si vous voulez qu'ils diffèrent, cela doit venir des réglages d'affichage du client lui-même.

Pour vérifier l'échelle, comparez la cascade sommée sur la bande passante au S-mètre sur une fréquence **calme**. Sur une porteuse, une bande passante SSB exclut la porteuse elle-même et les deux ne sont pas comparables.

### La cadence d'images — `wf_fps_max`

Un client Kiwi demande la cascade la plus rapide qu'il puisse avoir (`SET wf_speed=4`) et cale son défilement — ainsi que le moyennage de son spectre — sur la cadence que le serveur annonce. Si les deux divergent, l'affichage paraît poussif alors que rien n'est réellement en retard.

Le récepteur produit `2 × sps / fft_size` spectres par seconde. Les clients Kiwi sont servis à partir de chacun d'eux et éclaircis à la cadence qu'ils ont demandée ; la page web garde son propre rythme, plus lent, et n'est pas affectée.

```toml
[kiwi_emulation]
enabled    = true
wf_fps_max = 23         # images par seconde
```

`23` est le maximum que déclare le protocole KiwiSDR lui-même, et le défaut sûr. **C'est toujours la plus petite de `wf_fps_max` et de la cadence propre du récepteur qui l'emporte** : l'augmenter ne fait donc quelque chose que si votre FFT est assez rapide pour avoir des images en réserve. Exemple, pour un récepteur à 60 Méch/s avec une FFT de 4194304 points — `2 × 60000000 / 4194304 = 28,6` images par seconde :

| `wf_fps_max` | livré |
|---|---|
| absent (défaut 23) | 23,0 i/s |
| `28` | 28,0 i/s |
| `40` | 28,6 i/s — le plafond propre du récepteur l'emporte |

`SET wf_speed` venant du client est également honoré : `0` arrêt, `1` = 1 i/s, `2` le quart du maximum, `3` la moitié, `4` le maximum. Un client sur une liaison étroite peut ainsi en demander moins.

> **Que l'augmenter aide relève du client, pas du serveur.** Un client qui dessine chaque image à son arrivée vous donne un défilement plus fluide ; un client qui se cale sur les 23 qu'il attend se contentera de mettre les images en trop en file d'attente, et la latence grandira. Essayez, et si la cascade paraît plus poussive plutôt que plus fluide, remettez `23`.

### Ce qui fixe le reste du retard

Si vous traquez la latence, l'essentiel n'est pas dans la passerelle. La fenêtre d'analyse fait `fft_size / sps` de large — 70 ms pour une FFT de 4194304 points à 60 Méch/s — et un échantillon attend en plus jusqu'à la moitié de cela que le saut se remplisse. Diviser `fft_size` par deux divise les deux par deux et double la cadence d'images, mais divise aussi par deux votre résolution en fréquence, dont vivent les décodeurs à bande étroite (WSPR, FT8, CW). Sur la plupart des récepteurs c'est un mauvais marché pour quelques dizaines de millisecondes. C'est une décision dans `[input]`, et non quelque chose que la passerelle puisse changer.

---

## 9. Si quelque chose ne va pas

Chaque commande envoyée par un client Kiwi est écrite dans **`/tmp/kiwi_retune.log`** — les demandes d'accord, les changements de mode, l'authentification, et tout ce que la passerelle n'a pas reconnu. Cela ne coûte rien de mesurable et est fait pour rester en place. Quand un client se comporte bizarrement, ce fichier montre ce qu'il a réellement demandé, ce qui est en général toute la réponse.

| Symptôme | Regardez |
|---|---|
| Le client se connecte et se déconnecte aussitôt | `[kiwi_emulation] enabled = true` absent de la configuration avec laquelle le serveur a été **lancé** |
| Pas d'audio, pas de cascade, pas de lignes de journal | le backend n'a pas été recompilé après `kiwi_install.sh` — lancez `./recompile.sh`, option `[1]` |
| `kiwi_install.sh` s'arrête sur un correctif | le message nomme le fichier et l'ancre ; l'arborescence a divergé de ce qu'attend le correctif, et ce fichier est resté intact |
| Audio présent mais maigre et faible | c'est attendu — réglez `audio_gain`, voir la [section 6](#6-niveau-audio) |
| La cascade défile poussivement | `wf_fps_max`, voir la [section 8](#8-cascade-et-spectre) |
| L'accord dans le client ne fait rien | une entrée IQ (`signal = "iq"`) ; l'accord n'est implémenté que pour les entrées réelles |
| Un réglage modifié n'a rien changé | ces clés sont lues au démarrage — redémarrez le récepteur |

> **L'AGC est du côté client.** `SET agc=` venant d'un client Kiwi est accepté et ignoré — l'audio arrive avec l'AGC propre de PhantomSDR appliqué, et les commandes d'AGC du client agissent sur ce qu'il reçoit.

---

## 10. Jusqu'où cela a été vérifié

Le format sur le fil a été contrôlé face à un récepteur en fonctionnement et relu ligne à ligne face au code des deux clients qu'il vise — le `KiwiSdrProtocol.cpp` d'AetherSDR et le `kiwi/client.py` de kiwiclient. Disposition et taille des trames, numéros de séquence, ordre des octets, échelle du S-mètre, accord et cascade concordent tous. La passerelle a en outre été **confirmée fonctionnelle avec l'application de bureau AetherSDR** elle-même, par son mainteneur, face à ce récepteur.

Mesuré sur ce récepteur, avec un client de test sur les sockets en service : l'accord aboutit en 35–50 ms, l'audio tourne en temps réel sans dérive, et la cascade délivre la cadence configurée sans blocage ni image perdue.

Si malgré tout quelque chose paraît faux sur votre propre installation, `/tmp/kiwi_retune.log` est le premier endroit où regarder, et un retour est bienvenu dans les deux cas.

---

**Voir aussi :** [Guide d'installation](INSTALLATION.md) · [Structure du projet](PROJECT_STRUCTURE.md) · [Guide de l'utilisateur](USER_GUIDE.md)
