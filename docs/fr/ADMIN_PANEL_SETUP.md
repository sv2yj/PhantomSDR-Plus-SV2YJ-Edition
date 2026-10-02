# Panneau d'administration PhantomSDR-Plus — Guide de configuration

> ⚠️ **Avis de sécurité :** gardez ce panneau d'administration sur votre réseau domestique ou derrière un VPN. L'exposition publique du port d'administration n'est pas recommandée sans un durcissement d'authentification approprié.

---

## Vue d'ensemble

Le panneau d'administration se compose de deux services Python :

| Service | Fichier | Rôle |
|---|---|---|
| Panneau d'administration | `admin_server.py` | Application web Flask, liée à `127.0.0.1` (interne uniquement) |
| Proxy inverse | `proxy.py` | Expose à la fois le SDR et le panneau d'administration sur un seul port public |

Les deux services lisent leur configuration dans `admin_config.json`, écrit par `setup_admin.sh`. **Ne modifiez pas directement les constantes de port dans les fichiers Python** — tous les ports et l'adresse IP de l'hôte SDR sont stockés dans `admin_config.json`.

---

## Ce que vous apporte le panneau d'administration

- **Tableau de bord** — état du serveur en direct, CPU/RAM, processus principaux, sortie récente des journaux, terminal
- **Éditeur de configuration** — consultez, modifiez et enregistrez n'importe quel fichier `.toml`, `.sh`, `.json`, `.h`, `.cpp` de votre installation
- **Visionneuse de journaux** — suivez n'importe quel fichier journal en temps réel (serveur SDR, panneau d'administration, RADE, plantages, autorun, proxy)
- **Marqueurs** — consultez et modifiez les marqueurs de fréquence
- **Historique du chat** — consultez le journal du chat WebSDR, effacez-le entièrement ou supprimez des messages individuels sans redémarrer le serveur
- **Message sur la cascade** — diffusez une bannière persistante à tous les utilisateurs connectés, visible en temps réel sur l'affichage en cascade
- **Utilisateurs** — liste en direct des auditeurs connectés avec leur fréquence, leur mode, leur durée de connexion et un bouton ⚡ Kick
- **Suppression de messages du chat** — bouton 🗑 Delete qui retire immédiatement ce seul message du journal
- **Messages diffusés sur la cascade** — permet de pousser une bannière de texte persistante sur la cascade de chaque utilisateur connecté
- **Spot Reporting** — démarrez/arrêtez le décodeur autorun FT8/FT4/JS8/WSPR, choisissez les bandes/modes et rapportez les spots à PSK Reporter / wsprnet (désactivé par défaut), avec deux compteurs : des tuiles par décodeur pour l'exécution en cours et un total depuis toujours à côté de chaque case bande/mode
- **Graphiques** — fréquence du CPU, charge du CPU, température du CPU et utilisateurs connectés, tracés sur les 15 dernières minutes / 1 heure / 4 heures / 12 heures / 24 heures
- **Protection thermique (Thermal Guard)** — arrête le serveur si le processeur surchauffe et le redémarre une fois refroidi, avec des seuils déduits de votre propre processeur ; fonctionne avec n'importe quelle méthode de démarrage/arrêt et est livrée en mode journalisation seule, elle ne fait donc rien tant que vous ne l'activez pas
- **Paramètres** — modifiez le mot de passe d'administration, le répertoire de base du SDR, le nom du processus, le port public

---

## Prérequis

- PhantomSDR-Plus déjà installé et en cours d'exécution
- Python 3.8+

> [!NOTE]
> **En temps normal, l'installateur le fait pour vous.** `./install.sh` — comme chacun des quatre installateurs par distribution, les deux installateurs RADE et celui du serveur de statistiques — met le panneau en place par défaut, en installant d'abord `pip` avec le gestionnaire de paquets du système s'il manque. Cette page décrit ce qui se passe à cette étape, et quoi faire si vous l'avez sautée ou souhaitez changer quelque chose ensuite.

Les bibliothèques Python du panneau (`flask`, `psutil`, `aiohttp`, `tomli-w`) sont installées par `setup_admin.sh` ; en cas d'échec, il affiche la commande exacte à lancer.

---

## Étape 1 — Fichiers

Placez ces quatre fichiers dans votre répertoire PhantomSDR-Plus :

```
admin_server.py
manage_admin.sh
setup_admin.sh
proxy.py
```

Rendez les scripts shell exécutables :

```bash
chmod +x setup_admin.sh manage_admin.sh
```

---

## Étape 2 — Lancer le script d'installation

```bash
./setup_admin.sh
```

Le script va :

1. Vérifier que Python 3 est installé
2. Vérifier la présence de `admin_server.py` et `manage_admin.sh`
3. Enregistrer `127.0.0.1` comme `sdr_host` dans la configuration (voir [Le réglage `sdr_host`](#le-réglage-sdr_host))
4. Demander trois numéros de port. Chaque invite propose une valeur par défaut entre crochets
qu'une simple touche Entrée accepte, si bien qu'une installation normale tient en trois frappes :
   - **Port de spectrumserver** — le port sur lequel votre serveur SDR écoute (par défaut `8900`,
     c'est-à-dire celui que livre chaque `config-*.toml` du dépôt)
   - **Port interne du panneau d'administration** — là où `admin_server.py` se lie localement (par défaut `3000`)
   - **Port public du proxy** — l'unique port externe combinant SDR + administration (par défaut `8902`)

Les réponses invalides sont rejetées et redemandées, mais cinq fois seulement — ensuite la valeur par défaut est retenue. Une exécution dont l'entrée n'est pas un terminal (tube, cron, sans surveillance) prend aussitôt les valeurs par défaut au lieu d'attendre une saisie qui ne viendra jamais.
5. Installer `flask`, `psutil`, `aiohttp` et `tomli-w` via pip
6. Accorder à `ss` la capacité `cap_net_admin` (voie de repli de l'éjection d'utilisateurs, utile seulement si le panneau tourne sans le proxy)
7. Demander quel script démarre et quel script arrête le récepteur — c'est par eux que le panneau pilote le serveur, et la protection thermique aussi
8. Demander jusqu'où la protection thermique du processeur peut aller d'elle-même — `log`, `throttle`, `stop` ou `stop+restart` — et proposer d'exécuter `setup-cpufreq-perms.sh` pour que l'étage throttle fonctionne sans root (voir [THERMAL_GUARD.md](THERMAL_GUARD.md))
9. Écrire `admin_config.json` avec tous les réglages
10. Proposer d'installer deux unités systemd (panneau + proxy) — démarrage au boot et redémarrage après un plantage. **Recommandé, et proposé par défaut** (un simple Entrée suffit) : la protection contre la surchauffe ne tourne que tant que le panneau tourne ; sans les unités, un redémarrage laisse la machine sans protection. L'étape est ignorée automatiquement là où systemd n'est pas PID 1 (conteneurs, WSL1, OpenRC) ou si vous n'avez pas sudo.

Après l'installation, ouvrez votre navigateur via le proxy :
```
http://YOUR_SERVER_IP:<proxy_port>/admin
```
Mot de passe par défaut : **`admin`**

> ⚠️ **Changez immédiatement le mot de passe** — allez dans Settings à la première connexion. Un assistant de premier lancement vous guidera pour définir le répertoire SDR, le nom du processus, le port public et un nouveau mot de passe.

---

## Étape 3 — Démarrer / arrêter / redémarrer

Il y a deux façons de faire tourner le panneau et le proxy. **Choisissez-en une et tenez-vous-y** — l'avertissement en fin de section explique ce qui se passe si vous les mélangez.

> **La méthode B (systemd) est fortement recommandée** partout où systemd est disponible. La protection thermique tourne dans le panneau : un panneau qui meurt à 03:00, ou une machine qui redémarre, laisse le processeur sans protection jusqu'à ce que quelqu'un le relance à la main. `setup_admin.sh` propose désormais les unités par défaut. Utilisez la méthode A lorsqu'il n'y a pas de systemd — conteneurs, WSL1, OpenRC/sysvinit — ou si vous voulez délibérément assurer vous-même la supervision.

### Méthode A — `manage_admin.sh` (sans root, rien à installer)

```bash
./manage_admin.sh start      # start admin panel and proxy
./manage_admin.sh stop       # stop both
./manage_admin.sh status     # show running status and PIDs
```

Il n'y a délibérément **pas de `restart`**. Il tuait le panneau et démarrait aussitôt sa propre copie, ce qui entre en conflit avec systemd sur toute machine utilisant la méthode B. Pour redémarrer avec la méthode A, lancez `stop` puis `start` — voir [Redémarrer le panneau](#redémarrer-le-panneau) ci-dessous.

Un seul script pilote **les deux** processus. Il vérifie qu'`aiohttp` est installé avant de démarrer le proxy et affiche une erreur claire avec la commande de correction s'il manque.

Rien ne démarre tout seul : après un redémarrage, ou si le panneau plante, vous le relancez à la main. C'est acceptable pour un récepteur que vous surveillez, mais notez que la protection thermique du processeur tourne à l'intérieur du panneau : tant que le panneau est arrêté, rien ne protège la machine (voir [THERMAL_GUARD.md](THERMAL_GUARD.md)).

### Méthode B — unités systemd (démarrage au boot, redémarrage après plantage)

Le dépôt fournit deux unités prêtes à l'emploi, `phantomsdr-admin.service` et `phantomsdr-proxy.service`. Adaptez `User=` et les chemins dans les deux, puis :

```bash
sudo cp phantomsdr-admin.service phantomsdr-proxy.service /etc/systemd/system/
sudo systemctl daemon-reload
./manage_admin.sh stop        # free the ports first
sudo systemctl enable --now phantomsdr-admin
sudo systemctl enable --now phantomsdr-proxy
```

Les commandes quotidiennes deviennent alors :

```bash
sudo systemctl start   phantomsdr-admin
sudo systemctl stop    phantomsdr-admin
sudo systemctl restart phantomsdr-admin
systemctl status       phantomsdr-admin
sudo journalctl -u phantomsdr-admin -f
```

Les mêmes quatre avec `phantomsdr-proxy`, ou les deux à la fois : `sudo systemctl restart phantomsdr-admin phantomsdr-proxy`.

`admin.log` et `proxy.log` fonctionnent exactement comme avant — les unités écrivent dans ces mêmes fichiers.

Une chose à faire une fois pour toutes : installer la règle tmpfiles de `tmpfiles/phantomsdr-logs.conf` (modifiez d'abord ses chemins et son utilisateur). systemd crée ces deux journaux en tant que `root` avant de descendre vers `User=`, et le bouton **Clear Logs** du panneau échoue alors avec `Permission denied` — voir plus bas « Clear Logs indique Permission denied ». `setup_admin.sh` installe la règle pour vous.

L'unité du panneau porte `SupplementaryGroups=cpufreq`, ce qui permet à l'étage throttle de la protection thermique d'abaisser la fréquence du processeur sans faire tourner le panneau en root. Créez d'abord ce groupe avec `./setup-cpufreq-perms.sh`, sinon systemd refusera de démarrer l'unité ; supprimez la ligne si vous n'utilisez pas l'étage throttle.

Pour revenir à la méthode A :

```bash
sudo systemctl disable --now phantomsdr-admin
sudo systemctl disable --now phantomsdr-proxy
```

> ⚠️ **Ne mélangez pas les deux.** Avec les unités activées, `./manage_admin.sh stop` est annulé par systemd cinq secondes plus tard, et `./manage_admin.sh start` vous donne une seconde copie non gérée qui se dispute le même port avec celle de systemd. (`restart` a été retiré du script précisément pour cela ; il affiche désormais une erreur qui renvoie à `systemctl`.) `./manage_admin.sh status` ne fait que lire : il reste utile dans les deux cas.

### Redémarrer le panneau

La suite de ce document dit « redémarrez le panneau » à plusieurs endroits. Cela désigne celle de ces commandes qui correspond à votre méthode :

```bash
# Méthode B — unités systemd (l'installation normale)
sudo systemctl restart phantomsdr-admin phantomsdr-proxy

# Méthode A — aucune unité installée
./manage_admin.sh stop && ./manage_admin.sh start
```

L'unité fournit `KillMode=process`, et cette ligne est déterminante. Si vous démarrez le SDR depuis le panneau, le récepteur est un fils de l'unité d'administration et hérite de son cgroup. Avec la valeur par défaut de systemd, `KillMode=control-group`, redémarrer le panneau emporterait spectrumserver, son chien de garde et le démon autorun — après avoir bloqué les 90 secondes entières du délai d'arrêt. Avec `KillMode=process`, systemd ne signale que le panneau, si bien que `sudo systemctl restart phantomsdr-admin` laisse à l'antenne un récepteur occupé.

**Mettre à niveau une unité installée avant la v4.1.0.** Les anciens fichiers d'unité ne comportent pas cette ligne, et redémarrer le panneau ne l'ajoute pas : `systemctl restart` relance le programme, il ne modifie pas sa configuration. Modifiez la copie *installée* — celle du dépôt n'est qu'un modèle que systemd ne lit jamais :

```bash
sudo nano /etc/systemd/system/phantomsdr-admin.service
```

Ajoutez `KillMode=process` dans la section `[Service]`, à côté de `Restart=always`. Faites ensuite relire le fichier par systemd et vérifiez :

```bash
sudo systemctl daemon-reload
systemctl show phantomsdr-admin -p KillMode
```

La seconde commande doit afficher `KillMode=process`. Si elle affiche encore `control-group`, systemd utilise sa copie en cache — `systemctl show phantomsdr-admin -p NeedDaemonReload` renvoie `yes` tant qu'un rechargement est en attente. Les espaces en début de ligne sont ignorés dans les fichiers d'unité : l'indentation n'a donc aucune importance.

---

## Étape 4 — Ouvrir le port du pare-feu

N'ouvrez que le **port public du proxy** dans votre pare-feu. Il est inutile d'exposer le port interne du panneau d'administration :

```bash
sudo ufw allow <proxy_port>
```

---

## Étape 5 — Fonction d'éjection d'utilisateurs

La page Users affiche chaque auditeur actuellement connecté. Chaque ligne indique l'IP de l'utilisateur, sa fréquence, son mode et depuis combien de temps il est connecté. Pour déconnecter un utilisateur, cliquez sur le bouton **⚡ Kick** de sa ligne — seule cette connexion TCP est coupée. Tous les autres auditeurs restent connectés et n'entendent rien.

L'éjection est instantanée et chirurgicale : le serveur ne redémarre pas, l'audio n'est interrompu pour personne d'autre, et l'utilisateur éjecté peut se reconnecter immédiatement (la fonction sert à supprimer des connexions problématiques ou bloquées, pas à bannir).

En interne, l'éjection utilise `ss -K dst <IP> dport <port>` pour fermer le socket TCP concerné. Cela nécessite une capacité Linux que le script d'installation accorde automatiquement. Si vous avez sauté cette étape ou si le bouton signale une erreur, appliquez-la manuellement :

```bash
sudo setcap cap_net_admin+ep $(which ss)
# Verify:
getcap $(which ss)    # should show: cap_net_admin=ep
```

---

## Configuration — admin_config.json

Toute la configuration d'exécution se trouve dans `admin_config.json`, dans votre répertoire PhantomSDR-Plus. `setup_admin.sh` écrit le fichier initial ; les modifications ultérieures peuvent se faire via la page Settings ou en éditant directement le fichier.

Champs clés écrits par `setup_admin.sh` :

| Clé | Description |
|---|---|
| `port` | Port interne du panneau d'administration (`admin_server.py` s'y lie) |
| `public_port` | Port de spectrumserver (utilisé par la page Users pour interroger `/users`) |
| `proxy_port` | Port public sur lequel le proxy écoute |
| `sdr_host` | Hôte utilisé par le proxy pour atteindre spectrumserver — `127.0.0.1` (voir ci-dessous) |
| `password_hash` | Empreinte SHA-256 du mot de passe d'administration |
| `sdr_base_dir` | Chemin de votre installation PhantomSDR-Plus |
| `sdr_process_name` | Nom du processus à surveiller (par défaut : `spectrumserver`) |
| `start_script` / `stop_script` | Scripts que le panneau exécute pour démarrer et arrêter le serveur SDR — c'est aussi par eux qu'agit la protection thermique |

Clés de la protection thermique (toutes facultatives — le panneau les écrit lorsque vous enregistrez les réglages Thermal Guard, et celles qui manquent prennent ces valeurs par défaut) :

| Clé | Défaut | Description |
|---|---|---|
| `thermal_enabled` | `true` | Interrupteur général de la protection |
| `thermal_mode` | `"log"` | `log` (journaliser seulement, n'agit jamais) · `throttle` · `stop` · `stop+restart` |
| `thermal_warn` | `null` | Température d'avertissement °C ; `null` = déduire du seuil critique de votre processeur |
| `thermal_throttle` | `null` | Température à laquelle le plafond de fréquence est abaissé ; `null` = automatique |
| `thermal_stop` | `null` | Température à laquelle le serveur est arrêté ; `null` = automatique |
| `thermal_resume` | `null` | Température sous laquelle le processeur doit redescendre pour récupérer ; `null` = automatique |
| `thermal_sustain_s` | `60` | Secondes pendant lesquelles la température d'arrêt doit être tenue |
| `thermal_warn_sustain_s` | `30` | Secondes pendant lesquelles les températures d'avertissement/throttle doivent être tenues |
| `thermal_resume_s` | `300` | Secondes sous la température de récupération avant la levée du verrou |
| `thermal_max_stops_hour` | `2` | Arrêts thermiques par heure avant désactivation du redémarrage automatique |
| `thermal_test_temp` | `null` | Température fictive pour tester la protection ; `null` = utiliser le vrai capteur |

Ces changements prennent effet à la mesure suivante — en quelques secondes, sans redémarrage.

Pour changer de ports après l'installation initiale, modifiez `admin_config.json` et redémarrez :

```bash
sudo systemctl restart phantomsdr-admin phantomsdr-proxy   # B
./manage_admin.sh stop && ./manage_admin.sh start        # A
```

---

## Le réglage `sdr_host`

`proxy.py` se connecte à `spectrumserver` par bouclage — `sdr_host` vaut `127.0.0.1` dans `admin_config.json`, écrit là par `setup_admin.sh`. Vous ne devriez pas avoir à le modifier.

Ne mettez une adresse réelle que si `spectrumserver` tourne sur une **autre machine** que le proxy. Ensuite, [Redémarrer le panneau](#redémarrer-le-panneau).

> **Changement :** les versions antérieures exigeaient que `sdr_host` soit l'IP LAN de la machine, car `spectrumserver` fermait les WebSocket arrivant de l'adresse de bouclage. Ce filtre a été supprimé, les connexions locales fonctionnent donc normalement. Deux conséquences : ouvrir `http://localhost:<port>` sur la machine du serveur elle-même affiche désormais l'interface complète (auparavant la page se chargeait mais restait vide), et le proxy ne casse plus quand le DHCP réattribue l'IP de la machine. Si vous mettez à jour et que votre `admin_config.json` contient encore une IP LAN, remplacez-la par `127.0.0.1` ou relancez `setup_admin.sh`.

---

## proxy.py — ce que c'est et quand il est nécessaire

`proxy.py` place à la fois le serveur SDR et le panneau d'administration sur un **seul port public**, en routant par préfixe de chemin :

| Chemin | Redirigé vers |
|---|---|
| `/admin*` | Panneau d'administration (`localhost:<port>`) |
| Tout le reste | Spectrumserver (`<sdr_host>:<public_port>`) |

Sans le proxy, vous devez exposer deux ports séparément. Avec lui, vous n'en exposez qu'un.

Le proxy supprime également la limite de 4 Mo sur la taille des messages WebSocket (important pour les grandes trames FFT du RX-888 à 60 MSPS), transmet les vraies IP des clients via les en-têtes `X-Forwarded-*` et maintient les connexions de longue durée à travers le NAT grâce à un battement de cœur toutes les 30 secondes.

---

## Changer de ports après l'installation

Modifiez directement `admin_config.json` :

```json
{
  "port":        3000,
  "public_port": 9001,
  "proxy_port":  9002,
  "sdr_host":    "127.0.0.1"
}
```

Puis redémarrez les deux services :

```bash
sudo systemctl restart phantomsdr-admin phantomsdr-proxy   # B
./manage_admin.sh stop && ./manage_admin.sh start        # A
```

Si vous avez également besoin que `admin_server.py` se lie à un autre port au lancement (p. ex. pour le service systemd), vous pouvez le remplacer par la variable d'environnement :

```bash
ADMIN_PORT=3000 python3 admin_server.py
```

Par défaut, `admin_server.py` ne se lie qu'à `127.0.0.1`. Pour l'exécuter seul sans le proxy (développement/tests), liez-le à toutes les interfaces :

```bash
ADMIN_BIND=0.0.0.0 python3 admin_server.py
```

---

## Commandes manuelles utiles

```bash
# Start admin panel manually (foreground)
python3 ~/PhantomSDR-Plus/admin_server.py

# Kill the admin panel
pkill -f admin_server.py

# Kill the proxy
pkill -f proxy.py

# Free a port that is stuck in use
sudo fuser -k 3000/tcp

# Check what is listening on a port
ss -tlnp | grep 3000
```

---

## Fichiers journaux

| Fichier | Contenu |
|---|---|
| `admin.log` | Sortie du panneau d'administration |
| `proxy.log` | Bannière de démarrage du proxy + une ligne de journal d'accès par requête relayée |
| `logwebsdr.txt` | Journal du lanceur et du chien de garde — démarrage/arrêt, pilote du récepteur, enregistrement sur websdr.org |
| `spectrumserver.log` | La sortie du processus récepteur lui-même — mise en place FFT et OpenCL, connexions de chaque client, erreurs. Le plus gros de ces fichiers ; il est tourné, un `spectrumserver.log.1` peut donc se trouver à côté |
| `rade.log` | Journal du sidecar RADE/FreeDV |
| `autorun.log` | Journal du démon de décodage — spots, SNR, dérive |
| `crash.log` | Rapports de plantage et événements thermiques : traces `[CRASH]` / `[TERMINATE]`, notes `[EXIT]` et lignes `[THERMAL]` de la protection. **Normalement vide** — tout ce qu'il contient mérite d'être lu |

Tous ces fichiers sont consultables depuis les onglets **Log Viewer** du panneau (LOGWEBSDR, SPECTRUMSERVER, ADMIN, RADE, CRASH, AUTORUN, PROXY). Le visualiseur affiche les 150 dernières lignes de l'onglet choisi et se rafraîchit toutes les 3 secondes quand le rafraîchissement automatique est actif ; il ne lit que la fin du fichier, sa taille est donc sans importance.

### Rotation de proxy.log et admin.log

`proxy.log` enregistre chaque requête relayée et `admin.log` chaque requête qui atteint le panneau lui-même. Aucun des deux ne fait l'objet d'une rotation par défaut. L'interrogation du tableau de bord dominait autrefois les deux fichiers — `/admin/api/status` est appelée toutes les ~3 secondes tant qu'un onglet reste ouvert — mais ces interrogations sont désormais filtrées des deux journaux (voir plus bas) ; la rotation sert donc à borner une croissance lente, pas un flot.

Le dépôt fournit une configuration logrotate dans `logrotate/phantomsdr` (quotidienne, ou plus tôt si un journal dépasse 10 Mo ; conserve 7 archives compressées dans `logproxy/`, afin qu'elles n'encombrent pas la racine du projet). **Elle dépend du site — ouvrez-la et changez les trois chemins de journaux, le chemin `olddir` et l'utilisateur `su` pour correspondre à votre machine avant de l'installer**, puis :

```bash
sudo cp logrotate/phantomsdr /etc/logrotate.d/phantomsdr
sudo logrotate -d /etc/logrotate.d/phantomsdr     # dry run, should list all three logs
```

`logrotate/phantomsdr` dans le dépôt et `/etc/logrotate.d/phantomsdr` sont deux copies **indépendantes** — `cp` ne les relie pas. Modifier le fichier du dépôt ne change rien sur un système en fonctionnement tant que vous n'avez pas relancé le `sudo cp` ci-dessus. Seule la copie dans `/etc` est réellement lue par logrotate.

La configuration utilise `copytruncate`, ce qui est indispensable : `manage_admin.sh` démarre les deux processus avec `>> <log>` et aucun ne rouvre sa sortie standard ; une rotation par renommage les laisserait donc écrire dans le fichier pivoté tandis que le nouveau journal resterait éternellement vide.

Les archives arrivent dans `logproxy/` (créé automatiquement par `createolddir`) et sont nommées `proxy.log.1.gz` … `proxy.log.7.gz`, la plus récente en premier. Lisez-en une avec `zcat logproxy/proxy.log.1.gz | less`, ou cherchez dans toutes à la fois avec `zgrep "pattern" logproxy/*.gz`.

Le bouton **Clear Logs** du panneau tronque **tous** les fichiers du tableau ci-dessus, `autorun.log` et `proxy.log` compris (`CLEAR_EXCLUDE` dans `admin_server.py` est vide). Notez ce que cela coûte sur `autorun.log` : son historique de décodage est le seul enregistrement de ce qui a été entendu et quand, et il est impossible à reconstituer ; d'un vidage il ne survit que ce que logrotate a déjà basculé dans `logproxy/`, donc tout ce qui a été décodé depuis la dernière rotation est perdu. Le vider sous un décodeur en marche est sans danger : le démon le garde ouvert en `O_APPEND` et continue d'écrire dans le même inode. La notification indique ce qui a été vidé, et si un fichier n'a pas pu être écrit — un `proxy.log` appartenant à un autre utilisateur, par exemple, sur une installation à comptes séparés — elle nomme ce fichier et l'erreur au lieu d'annoncer une réussite, et laisse le volet de ce journal à l'écran au lieu de le vider. Les fichiers sont tronqués sur place, jamais supprimés : `manage_admin.sh` comme les unités systemd les ouvrent en `O_APPEND`, si bien qu'un fichier supprimé continuerait de remplir un inode invisible jusqu'au redémarrage du service.

Les interrogations réussies sont filtrées des **deux** journaux d'accès, par le `QuietPollFilter` de `proxy.py` et par celui d'`admin_server.py`. Le tableau de bord appelle `/admin/api/status` toutes les 3 secondes, et `/admin/api/logs`, `/admin/api/autorun/status`, `/admin/api/users`, `/admin/api/graph-stats` et `/admin/api/chat` toutes les 5 secondes ; sans filtrage elles représenteraient ~95 % des deux fichiers. Seuls les `200` simples sur ces chemins sont écartés — tout autre statut, chemin ou méthode est journalisé comme avant, de sorte qu'une interrogation en échec reste visible et que les actions modifiant l'état (`kick`, `autorun/start`, …) passent par des chemins distincts et sont toujours enregistrées. La seule exception délibérée est `/admin/api/logs/clear`, filtré dans les deux fichiers : sa propre ligne d'accès est écrite *après* la troncature, si bien que sans le filtre chaque effacement réussi laissait une ligne toute fraîche dans le journal qu'il venait de vider, et le bouton paraissait cassé.

Comme `proxy.log` est un journal d'accès, il contient les adresses IP des visiteurs et les chaînes user-agent — gardez-le à l'esprit avant de le partager pour demander de l'aide.

### « Clear Logs » indique Permission denied

Sur une machine où les unités systemd ont été installées sur une arborescence vierge, le bouton peut répondre :

```
✗ Could not clear admin.log ([Errno 13] Permission denied: /home/you/PhantomSDR-Plus/admin.log),
  proxy.log ([Errno 13] Permission denied: /home/you/PhantomSDR-Plus/proxy.log)
```

Ce sont toujours ces deux fichiers et jamais les cinq autres, car ce sont les seuls que systemd crée lui-même. `StandardOutput=append:` est ouvert par PID 1 **avant** de descendre vers `User=` ; un journal qui n'existe pas encore est donc créé en `root:root 0644`. Le panneau tourne sous votre utilisateur et ne peut pas le vider. Les cinq autres journaux sont créés par les scripts de lancement, qui tournent déjà sous votre utilisateur : ils se vident normalement. Là où les deux fichiers sont antérieurs aux unités — `manage_admin.sh` les a créés avec `>>` —, ils appartiennent déjà au bon utilisateur et le bouton fonctionne ; c'est pourquoi le problème n'apparaît que sur une installation neuve partie directement de systemd.

Vérifiez avec `ls -l admin.log proxy.log` : ceux qui échouent affichent `root root`. Réparez-les :

```bash
sudo chown "$(id -un):$(id -gn)" admin.log proxy.log
sudo chmod 664 admin.log proxy.log
```

Aucun redémarrage n'est nécessaire — systemd continue d'écrire via le descripteur de fichier qu'il détient déjà, et l'ajout ne change pas la propriété. Appuyez de nouveau sur **Clear Logs** et les deux sont vidés.

**Ne supprimez pas les fichiers à la place.** Tous deux sont ouverts en `O_APPEND` ; en supprimer un laisse systemd remplir un inœud invisible jusqu'au redémarrage du service, et le fichier qui réapparaît appartient de nouveau à root.

Pour que cela ne revienne pas, installez la règle tmpfiles fournie par le dépôt dans `tmpfiles/phantomsdr-logs.conf`. Elle recrée les deux journaux avec le bon propriétaire à chaque démarrage, avant le lancement des unités, de sorte qu'un journal supprimé — nettoyage manuel, réinstallation, répertoire d'installation déplacé — ne revienne jamais appartenant à root. **Elle est spécifique à la machine : ouvrez-la et modifiez d'abord les deux chemins et le user:group pour qu'ils correspondent au vôtre**, puis :

```bash
sudo cp tmpfiles/phantomsdr-logs.conf /etc/tmpfiles.d/99-phantomsdr-logs.conf
sudo systemd-tmpfiles --create /etc/tmpfiles.d/99-phantomsdr-logs.conf
```

Comme pour `logrotate/phantomsdr`, le fichier du dépôt et la copie dans `/etc` sont indépendants — modifier celui du dépôt ne change rien tant que vous n'avez pas relancé le `cp`. À partir de systemd 254, la règle répare aussi la propriété et le mode d'un journal déjà présent : elle corrige donc l'échec actuel autant que les suivants ; sur les versions plus anciennes, c'est le `chown` ci-dessus qui débloque le bouton.

`setup_admin.sh` fait tout cela pour vous lorsqu'il installe les unités : une installation faite avec le script ne rencontre jamais ce problème. Les étapes ci-dessus concernent une paire installée à la main, ou une installation antérieure à l'étape de propriété des journaux du script.

Logrotate ne réintroduit pas le problème : la configuration fournie utilise `copytruncate`, qui conserve le même inœud et donc le même propriétaire.

---

## Résumé des accès

| Configuration | SDR | Panneau d'administration |
|---|---|---|
| Sans proxy | `http://YOUR_IP:<public_port>` | `http://YOUR_IP:<port>/admin` |
| Avec proxy | `http://YOUR_IP:<proxy_port>` | `http://YOUR_IP:<proxy_port>/admin` |

---

## Suppression de messages du chat

La page Chat History liste tous les messages du journal de chat actuel. Chaque entrée dispose d'un bouton **🗑 Delete** qui retire immédiatement ce seul message du journal — sans redémarrer le serveur.

Fonctionnement :

- Le panneau d'administration réécrit le fichier de journal du chat sur place, en supprimant uniquement la ligne du message sélectionné.
- Le changement prend effet pour tout utilisateur qui recharge le chat ; l'historique déjà chargé dans les onglets ouverts n'est pas mis à jour rétroactivement.
- Effacer tout le journal (bouton **Clear All**) tronque le fichier, ce qui prend également effet sans redémarrage.

Le bouton de suppression est affiché de manière cohérente dans les cinq variantes de l'application Svelte. Si une suppression semble sans effet, vérifiez que le panneau d'administration a le droit d'écriture sur le fichier de journal du chat :

```bash
ls -l ~/PhantomSDR-Plus/chat.jsonl   # path depends on your config
```

---

## Messages diffusés sur la cascade

Le panneau **Waterfall Message** permet de pousser une bannière de texte persistante sur l'affichage en cascade de chaque utilisateur connecté, sans toucher au processus du serveur.

### Envoyer un message

1. Ouvrez le panneau d'administration et allez dans **Waterfall Message**.
2. Saisissez le texte de votre message et choisissez une couleur (hexadécimale, p. ex. `#ffdd00`).
3. Cliquez sur **Send** — le message apparaît immédiatement sur toutes les vues en cascade actives.

### Effacer le message

Cliquez sur **Clear** pour retirer la bannière de toutes les cascades. L'état du message est conservé en mémoire par le panneau d'administration ; il est effacé automatiquement si le processus du panneau redémarre.

### Fonctionnement

Le panneau d'administration expose deux points de terminaison internes que le proxy relaie :

| Point de terminaison | Méthode | Objet |
|---|---|---|
| `/admin/api/waterfall-message` | `POST` | Définir ou effacer le texte et la couleur de la bannière |
| `/admin/api/waterfall-message` | `GET` | Renvoyer l'état actuel du message au format JSON |

Le frontend interroge l'état du message et l'affiche en superposition sur le canevas de la cascade. Aucune reconnexion WebSocket ni rechargement de page n'est nécessaire côté client.

### Usages typiques

- Annoncer une maintenance programmée : `"Server restart in 10 minutes"`
- Signaler les conditions de propagation : `"Solar flux 180 — 10m wide open"`
- Message de bienvenue : `"Welcome to SV1BTL WebSDR — Athens, KM17"`

---

## Graphiques système

La page **Graphiques** trace quatre mesures sur un axe de temps commun :

- **Fréquence du CPU** — fréquence moyenne sur tous les cœurs, en GHz
- **Charge du CPU** — utilisation totale, en pourcentage
- **Température du CPU** — en °C, avec des repères pointillés à 70 °C (chaud) et 80 °C (critique)
- **Utilisateurs en ligne** — auditeurs connectés au WebSDR à cet instant

Choisissez la plage avec **15 MIN / 1 HOUR / 4 HOURS / 12 HOURS / 24 HOURS**. Le survol du graphique affiche un réticule et les quatre valeurs de cet instant. Les quatre cartes au-dessus montrent toujours l'échantillon le plus récent.

### Comment se fait l'échantillonnage

Un thread d'arrière-plan de `admin_server.py` prend un échantillon toutes les **2 secondes**. Les échantillons sont conservés sur deux niveaux : la dernière **heure** en pleine résolution de 2 secondes (1800 points) et **24 heures** de moyennes sur 30 secondes (2880 points) pour les plages longues. La page choisit le niveau qui couvre la plage demandée et affiche `30s averages` dans l'en-tête lorsqu'il s'agit du niveau moyenné.

Conserver une journée entière en résolution 2 secondes représenterait ~43000 points : des dizaines de Mo en mémoire, un premier transfert de plusieurs Mo et environ 40 points par pixel, ce qu'aucun écran ne peut afficher. La moyenne sur 30 secondes tient une journée en 2880 points.

L'échantillonnage démarre avec le panneau d'administration, et non à la première ouverture de la page : celle-ci s'ouvre donc sur un historique déjà constitué.

Le tampon est **uniquement en mémoire** : rien n'est écrit sur le disque et l'historique est perdu au redémarrage du panneau. C'est voulu — cela garde la fonction hors de la rotation des journaux et hors du disque.

2 secondes donnent une vue quasi temps réel et un intervalle assez court pour ne pas fausser la fréquence du CPU, qui sur un processeur moderne passe de son horloge de repos à son turbo d'un échantillon à l'autre. Un échantillon coûte environ une milliseconde : l'échantillonneur est donc négligeable face au serveur SDR. La page interroge au rythme de chaque niveau — toutes les 2 secondes sur les plages en direct, toutes les 30 secondes sur les plages moyennées, car demander plus souvent que les points ne sont produits ne renvoie que des réponses vides.

Pour changer la cadence ou la rétention, modifiez ces constantes au début du bloc d'échantillonnage dans `admin_server.py`, puis redémarrez :

```python
GRAPH_INTERVAL_S   = 2          # secondes entre les échantillons fins
GRAPH_FINE_S       = 3600       # profondeur du niveau fin (1 h)
GRAPH_COARSE_EVERY = 15         # échantillons fins par point agrégé (15 x 2 s = 30 s)
GRAPH_COARSE_S     = 24 * 3600  # profondeur du niveau agrégé (24 h)
```

### D'où viennent les chiffres

| Mesure | Source |
|---|---|
| Fréquence du CPU | `psutil.cpu_freq()`, à défaut `/sys/devices/system/cpu/cpu*/cpufreq/`. Ce sont les données noyau que `cpufreq-info` met en forme : **cpufrequtils n'est pas requis**. |
| Charge du CPU | `psutil.cpu_percent()` |
| Température du CPU | `psutil.sensors_temperatures()`, à défaut `/sys/class/thermal`, puis la commande `sensors` |
| Utilisateurs en ligne | Le point d'accès `/users` de spectrumserver lui-même — la liste de sessions faisant foi. Compter les sockets avec `ss` ne voit pas les vraies IP des clients derrière proxy.py. |

Si une mesure n'est pas disponible sur votre machine, le panneau le dit au lieu de tracer une ligne à zéro. Une lecture en échec interrompt la courbe, pour qu'un trou ne ressemble jamais à une valeur mesurée.

### Pourquoi quatre panneaux et non un seul graphique

Des GHz, des pourcentages, des degrés et un nombre de personnes n'ont pas d'échelle commune. Les réunir demanderait plusieurs axes y, et les croisements ainsi produits sont des artefacts de l'échelle, non des faits sur le serveur. Quatre panneaux empilés sur un même axe de temps gardent la comparaison honnête. Chaque panneau part de zéro, de sorte que la hauteur de la courbe reste proportionnelle à la valeur.

La couleur est réservée à la température, où l'ambre et le rouge marquent les seuils ci-dessus. Les autres panneaux partagent une seule couleur, car chacun ne contient qu'une série que son titre nomme déjà.

### Point d'accès

`GET /admin/api/graph-stats?since=<epoch>` (connexion requise) renvoie les échantillons postérieurs à `since`, ce qui permet à la page d'interroger de façon incrémentale au lieu de retélécharger tout le tampon à chaque cycle.

---

## Thermal Guard

> 📖 **Manuel complet : [THERMAL_GUARD.md](THERMAL_GUARD.md)** — les quatre modes et ce que le sysop doit faire pour chacun, le fonctionnement sans le panneau, l'étage throttle sans root, les tests et le dépannage.

Arrête le serveur SDR lorsque le processeur devient dangereusement chaud et le relance une fois refroidi. Elle fait partie du panneau — rien de plus à installer — et apparaît comme une carte **THERMAL GUARD** sur le Tableau de bord, ses réglages se trouvant dans **Paramètres**.

Elle est livrée **inerte** : le mode démarre sur `log`, elle se contente donc d'enregistrer ce qu'elle *aurait* fait. Rien ne touche à votre serveur tant que vous ne changez pas le mode.

### Elle fonctionne avec n'importe quelle méthode de démarrage/arrêt

La protection ne cherche jamais à savoir ce qui supervise votre serveur. Elle agit via les scripts que vous avez définis comme **Default start script** et **Default stop script** dans Paramètres, et tant que le processeur est en surchauffe elle réémet l'arrêt à **chaque vérification** (toutes les 2 s). Tout ce qui relance le serveur — le watchdog contenu dans `start-*.sh`, une unité systemd, une tâche cron, une session `tmux` — est défait en quelques secondes, jusqu'à ce que la machine ait refroidi. C'est le *verrouillage* (lockout).

Si aucun script d'arrêt n'est configuré, elle envoie `SIGTERM` au processus nommé dans `sdr_process_name`, puis `SIGKILL` après un délai de grâce de 10 secondes.

### Les seuils viennent de votre propre processeur

Plutôt qu'un nombre fixe qui serait faux sur la plupart des machines, la protection lit le seuil critique que le noyau publie pour votre processeur et remonte à partir de là :

| Votre processeur annonce | avertissement | throttle | arrêt | récupération |
|---|---|---|---|---|
| Intel, limite 100 °C | 88 | 92 | **95** | 75 |
| AMD Ryzen, limite 95 °C | 83 | 87 | **90** | 70 |
| Raspberry Pi, limite 85 °C | 73 | 77 | **80** | 60 |

C'est important : 95 °C fixes sont presque normaux sur un Intel, mais sur un Ryzen — dont la Tctl se tient à 95 °C par conception sous boost — cela arrêterait le serveur sur une machine en parfaite santé, et sur un Pi, qui limite dès 80 °C, cela ne se déclencherait jamais. Chaque seuil peut être fixé à la main dans Paramètres ; laissez le champ vide pour *automatique*.

Pour voir comment la protection perçoit votre machine :

```bash
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

### Les quatre étapes

Arrêter le serveur est le dernier recours, pas le seul outil :

1. **warn** — journalisé, rien d'autre.
2. **throttle** — abaisse de 20 % le plafond de fréquence du processeur. Nécessite un pilote cpufreq *et* le droit d'écriture sur `scaling_max_freq`, donc normalement root ; là où cela manque (le cas courant d'un panneau sans privilèges, et sur la plupart des VPS) l'étape **se désactive d'elle-même** et la protection passe de warn directement à stop. `./setup-cpufreq-perms.sh` accorde ce droit d'écriture à un groupe `cpufreq`, si bien que l'étape fonctionne sans root — voir [THERMAL_GUARD.md](THERMAL_GUARD.md#8-activer-létage-throttle-sans-root).
3. **stop** — exécute votre script d'arrêt et maintient le serveur à terre (voir le verrouillage).
4. **resume** — une fois le processeur resté sous la température de récupération pendant `thermal_resume_s` (5 minutes par défaut), le plafond de fréquence est rétabli et, en mode `stop+restart`, votre script de démarrage est relancé.

Chaque étape doit être **tenue** pendant sa durée — 30 s pour warn et throttle, 60 s pour stop — de sorte qu'un pic bref pendant une compilation ne la déclenche jamais.

Les déclenchements répétés sont plafonnés par `thermal_max_stops_hour` (2 par défaut). Une fois ce plafond atteint, le *redémarrage automatique* est désactivé tandis que la protection continue de fonctionner, afin qu'une machine en surchauffe n'oscille pas entre marche et arrêt.

### Quels capteurs sont utilisés

Uniquement de vrais capteurs sur la puce : `coretemp` (Intel), `k10temp` / `zenpower` (AMD), `cpu_thermal` / `soc_thermal` (ARM, Raspberry Pi). C'est la lecture la plus élevée de la puce qui est retenue, pas la moyenne.

`acpitz` et les zones thermiques non étiquetées sont **délibérément ignorés** : ils rapportent souvent une température de boîtier ou de carte inférieure de plusieurs dizaines de degrés au processeur réel, si bien qu'une protection qui leur ferait confiance ne se déclencherait jamais au moment voulu. Si votre machine n'a aucun capteur exploitable (fréquent sur un VPS ou dans un conteneur), la carte le dit clairement (`no trusted CPU sensor`) et la protection reste inactive plutôt que de faire semblant de vous protéger.

### Ce qu'elle écrit

Tout va dans `crash.log`, c'est-à-dire l'onglet **CRASH** du Log Viewer, un événement par ligne :

```
[THERMAL] warn: 89.0C (warn=88.0 crit=100.0) sustained 31s
[THERMAL] throttle: 93.0C sustained 30s — cpufreq max lowered 20%
[THERMAL] STOPPED server: 96.0C sustained 62s (stop=95.0 crit=100.0) — Started stop-websdr.sh
[THERMAL] lockout: process reappeared at 94.0C — re-stopped [3 time(s) so far]
[THERMAL] recovered: 74.0C held below 75.0 — lockout cleared
[THERMAL] auto-restart: Started start-rx888mk2.sh
```

La ligne de verrouillage est limitée à une par minute, pour qu'un superviseur qui résiste sans cesse n'inonde pas le journal.

### Testez-la avant de lui faire confiance

Réglez **TEST TEMPERATURE** dans Paramètres sur une valeur supérieure à votre seuil d'arrêt. La protection la traite comme une vraie mesure, si bien que tout le parcours — warn, throttle, stop, verrouillage, récupération, redémarrage — se déroule à la demande. Videz le champ pour revenir au capteur réel.

> Si vous faites ce test avec le mode sur `stop`, le serveur s'arrête réellement et vos auditeurs sont déconnectés. Faites-le quand personne n'écoute, ou laissez le mode sur `log`, où le test montre ce qui *serait* arrivé sans rien toucher.

### Manière recommandée de l'adopter

1. Laissez le mode sur **`log`** pendant une semaine et continuez normalement.
2. Lisez l'onglet CRASH après vos moments chargés — une recompilation complète, un après-midi de canicule. Si rien n'y figure, votre machine n'a jamais approché.
3. Si les températures relevées vous paraissent justes, passez le mode à **`stop`** (ou **`stop+restart`** pour qu'il revienne tout seul).
4. Vérifiez-le une fois avec le champ de température de test, puis laissez-le faire.

### Sortir d'un verrouillage

**CLEAR LOCKOUT** sur la carte du Tableau de bord efface le verrouillage et le plafond de déclenchements. Cela ne désarme pas la protection : si le processeur est encore trop chaud, la vérification suivante arrêtera simplement le serveur à nouveau. À utiliser après avoir corrigé le refroidissement.

### Endpoint

`GET /admin/api/thermal` (connexion requise) renvoie l'état complet de la protection — capteur, seuils, étape, verrouillage, dernier événement. Un `POST` avec `{"action":"reset"}` fait la même chose que le bouton CLEAR LOCKOUT.

### Sans le panneau d'administration

`thermal_guard.py` n'utilise que la bibliothèque standard et fonctionne seul, en lisant le même `admin_config.json` :

```bash
python3 thermal_guard.py --once              # afficher capteur, seuil critique et seuils
python3 thermal_guard.py                     # exécuter comme service (journalisation seule tant qu'il n'est pas armé)
python3 thermal_guard.py --mode stop+restart # l'armer sans écrire le moindre fichier de configuration
python3 thermal_guard.py --config /path/to/other.json
python3 thermal_guard.py --help
```

`--mode` l'emporte sur `thermal_mode` du fichier de configuration : une machine sans panneau peut donc être armée directement depuis son unité systemd, sans aucun JSON.

---

## Spot Reporting (autorun FT8/FT4/JS8/WSPR)

L'onglet **Spot Reporting** contrôle le démon autorun (`autorun/index.js`) — un processus Node.js qui décode FT8/FT4/JS8/WSPR côté serveur, directement depuis le récepteur, et téléverse les spots vers les réseaux de report :

- **FT8 / FT4 / JS8 → PSK Reporter** (IPFIX/UDP)
- **WSPR → wsprnet.org** (HTTP)

> **JS8 n'est spotté qu'à la vitesse Normal** — le cycle d'appel de 15 s, où se trouvent les heartbeats et les CQ. Les spots proviennent des heartbeats, des trames compound et des messages dirigés ; les destinations de groupe comme `@ALLCALL` et les indicatifs que le décodeur n'a pas pu résoudre (`<....>`) ne sont jamais rapportés. JS8 partage la file PSK Reporter avec FT8 et FT4 et est compté séparément, exactement comme eux.


**Le report est DÉSACTIVÉ par défaut.** Rien n'est téléversé tant que vous n'avez pas activé une destination et appuyé sur **Start**. Décodage et téléversement sont indépendants : le démon peut décoder et journaliser avec le report désactivé, ce qui vous permet de vérifier l'activité avant que quoi que ce soit ne devienne public.

> ⚠️ Les spots sont téléversés vers des réseaux publics sous **votre indicatif**. N'activez que les bandes/modes que votre récepteur entend véritablement, et indiquez le bon locator.

### Prérequis

Le démon autorun nécessite Node.js 22+, les paquets npm `ws` + `cbor-x` (résolus via le lien symbolique `autorun/node_modules` → `frontend/node_modules`) et `util-linux` (`taskset`). Les installateurs mettent tout cela en place automatiquement — voir la [section Rapporteur de spots autorun d'INSTALLATION.md](INSTALLATION.md#rapporteur-de-spots-autorun-ft8ft4wspr). Si **Start** échoue, ce lien symbolique ou `taskset` en est la cause habituelle (voir Dépannage ci-dessous).

### Utiliser l'onglet

1. **Identité** — indicatif et locator. Pré-remplis depuis `frontend/site_information.json` (`siteSysop` / `siteGridSquare`, tronqué à 6 caractères) ; remplacez-les ici si nécessaire.
2. **Matrice bande × mode** — cochez les combinaisons à décoder. Les lignes sont les bandes, les colonnes FT8 / FT4 / JS8 / WSPR ; les cases non prises en charge sont désactivées. WSPR couvre en outre les bandes LF/MF (2200 m, 630 m) et un canal 80 m EU supplémentaire.
3. **Destinations** — activez **PSK Reporter** et/ou **wsprnet** (désactivés par défaut).
4. **Max slots** — limite de sécurité sur le nombre de créneaux bande/mode simultanés.
5. **Start / Stop** — lance/arrête le démon (épinglé sur les cœurs CPU les plus élevés avec `taskset`, choisis automatiquement selon la machine — voir *Ressources requises et limitations* ci-dessous). **Save** / **Reload** enregistrent et relisent la configuration ; **Free All** libère tous les créneaux.

La carte d'état s'actualise toutes les 5 s et indique l'état d'exécution, les compteurs de décodage/téléversement et l'heure du dernier envoi. Un badge **📶 REPORTING** apparaît sur la cascade principale tant que le report est actif.

> **« 0 sent » pendant les premières minutes est normal.** PSK Reporter téléverse par lots toutes les **5 minutes** et wsprnet toutes les **2 minutes** — les spots patientent jusqu'au prochain envoi. La carte d'état affiche le nombre en attente et la cadence.

### Changer de bandes ou de modes en cours de fonctionnement

**Les changements ne prennent effet qu'après un redémarrage du démon.**
`autorun/index.js` lit `autorun.json` une seule fois, au démarrage. Il n'y a ni surveillance de fichier ni signal de rechargement : les seuls signaux traités sont SIGINT et SIGTERM, qui signifient tous deux l'arrêt. Un démon en cours continue donc à décoder les créneaux avec lesquels il a été lancé, quoi que vous enregistriez ensuite.

Pour appliquer un changement :

1. Cochez / décochez les bandes et modes
2. **SAVE CONFIG**
3. **STOP**
4. **START**

Ou simplement **STOP** → modifier les cases → **START**, puisque START enregistre la configuration avant de lancer.

> ⚠️ **Appuyer sur START sans arrêter d'abord n'applique pas le changement.** START enregistre la configuration, puis la requête de démarrage répond `already running` et rien n'est relancé. Vous voyez un message « enregistré » à côté d'une erreur « already running » alors que le démon poursuit avec les **anciennes** bandes — cela ressemble facilement à une réussite. Arrêtez toujours d'abord.

Ce qu'un redémarrage fait aux compteurs :

- **Les totaux à côté de chaque case sont conservés** : ils sont dans `autorun-totals.json`, qui n'est pas supprimé à l'arrêt.
- **Les tuiles par décodeur repartent de zéro**, elles valent par exécution.
- **Rien n'est perdu de la file** : l'arrêt envoie les spots en attente.
- Une bande **nouvellement activée** part de `0` ; une bande **déjà utilisée** reprend son total précédent.
- Une bande que vous **décochez garde son nombre** à côté de la case désormais vide ; l'historique n'est pas effacé.

Le décodage ne s'interrompt que les quelques secondes entre STOP et START.

### Compteurs de spots

Deux comptages différents sont affichés ; ils répondent à des questions différentes.

**SPOTS UPLOADED PER DECODER** — une tuile par décodeur (FT8 / FT4 / JS8 / WSPR) avec les spots envoyés **depuis le dernier démarrage du démon**, et en dessous le nombre de décodages et ceux encore en file. Stop/Start les remet à zéro. Un décodeur dont la destination est désactivée affiche ses décodages et `reporting off` plutôt qu'un simple `0` : ici, zéro envoi est un réglage, pas une panne.

**Le nombre à côté de chaque case** dans BANDS & MODES correspond aux spots envoyés **depuis toujours** pour cette bande et ce mode. Ils sont conservés dans `autorun-totals.json` et survivent aux redémarrages. **En ambre avec un point devant** (`·123`), cela signifie que ce créneau a décodé sans encore rien envoyer. C'est normal entre deux envois — PSK Reporter émet toutes les 5 minutes et wsprnet toutes les 2 — de sorte que les compteurs FT8/FT4 restent ambre les premières minutes après un démarrage. Ils restent également ambre si la destination de ce décodeur est désactivée. Un `0` simple, sans point, signifie que ce créneau est activé mais n'a encore rien décodé : WSPR reste à zéro plusieurs minutes après un démarrage, car il fonctionne sur un cycle de 2 minutes alors que FT8 compte déjà par centaines. Un créneau que le démon n'a jamais exécuté n'affiche rien. Le survol affiche les envois, les décodages et l'heure du dernier envoi.

FT8 et FT4 partagent une seule file d'envoi vers PSK Reporter : le démon impute donc chaque spot à son propre mode et à sa bande au moment de l'envoi ; la répartition n'est pas estimée après coup à partir des totaux.

**Remettre les compteurs à zéro.** **FREE ALL SLOTS** décoche toutes les bandes et tous les modes, désactive les deux destinations, arrête le démon et **efface les compteurs cumulés** : ensuite, plus aucun nombre n'apparaît à côté d'une case. C'est le seul moyen de les remettre à zéro, et l'opération est irréversible. Le bouton arrête le démon et attend sa sortie avant de supprimer `autorun-totals.json`, car le démon réécrit ce fichier à l'arrêt ; le supprimer sous un démon actif ne ferait que ramener les nombres.

### Ressources requises et limitations

Le démon est volontairement léger et fonctionne sur du matériel modeste (un i5 4 cœurs convient), mais il existe de vraies limites à connaître.

**L'épinglage CPU d'autorun tient compte de la configuration et est automatique.** Le **démon autorun** est toujours lancé par le panneau d'administration (`admin_server.py`), son épinglage est donc défini à chaque installation sans configuration : il déduit une plage de cœurs `taskset` du nombre de processeurs, en réservant quelques-uns des cœurs les plus élevés pour le décodage, ou tourne sans épinglage sur ≤ 4 cœurs.

**L'épinglage de spectrumserver dépend de votre méthode de démarrage.** La façon dont vous lancez spectrumserver varie d'une installation à l'autre (type de SDR, outillage, scripts personnels) ; ce document ne présuppose donc aucun lanceur particulier. Le panneau d'administration ne démarre ni n'épingle spectrumserver — cela dépend entièrement de la commande ou du service que vous utilisez. Si vous voulez tenir spectrumserver à l'écart des cœurs utilisés par le démon autorun, épinglez-le vous-même avec `taskset` dans votre propre commande de lancement (voir la section de remplacement ci-dessous). Sinon, il tourne sans épinglage et l'ordonnanceur du système l'équilibre — correct et sans risque, vous perdez simplement la séparation délibérée des cœurs.

À titre de référence, le démon autorun réserve ces cœurs élevés (si vous épinglez spectrumserver, restez donc sur les cœurs bas pour éviter le chevauchement) :

| CPU logiques | Utilisés par le démon autorun | À laisser à spectrumserver |
|---|---|---|
| ≤ 4 | *non épinglé* | *non épinglé* |
| 6 | `5` | `0-4` |
| 8 | `6-7` | `0-5` |
| 12 (p. ex. hybride 8P+4E) | `8-11` | `0-7` |
| 16 | `12-15` | `0-11` |

Sur une machine à **4 cœurs (ou moins)**, il n'y a rien à séparer : le démon autorun tourne donc lui aussi *sans épinglage* et partage tous les cœurs — correct et sans risque, mais la FFT du SDR et les rafales de décodage se disputent les mêmes cœurs.

**Limitations connues :**

1. **Le vrai goulot d'étranglement est spectrumserver + la largeur de bande du SDR, pas le démon.** Un RX888 à 30 MHz nécessite OpenCL/GPU ; un CPU à peu de cœurs sans GPU capable ne peut pas soutenir cette FFT. Associez le matériel modeste à un SDR plus étroit (RSP1A ≈ 10 MHz, RTL-SDR ≈ 2.4 MHz).
2. **WSPR est le poste le plus coûteux en CPU.** Son décodeur de Fano est un portage JS (~30 s par bande, mono-thread). Le pool de 4 workers exécute 4 décodages en parallèle ; activer **plus de ~4 bandes WSPR** à la fois peut faire déborder la file au-delà du créneau de 120 s, surtout pendant que le SDR se dispute les cœurs. Les décodages FT8/FT4 sont peu coûteux en comparaison.
3. **Mise à l'échelle du nombre de créneaux.** Les chiffres de ~2 à 2,5 cœurs / 600 à 700 Mo correspondent aux ~28 créneaux complets sur une machine à 8 cœurs. Sur 4 cœurs partagés, limitez-vous à quelques bandes (règle : ≤ 6 FT8/FT4 + ≤ 3 WSPR) et surveillez la statistique `queued` du pool.
4. **L'épinglage suppose une topologie hybride Intel** (cœurs bas = P-cores plus rapides). Sur AMD ou sur des CPU à numérotation SMT entrelacée, la répartition automatique reste valable (pas de chevauchement, pas de plantage) mais « les cœurs bas sont plus rapides » peut ne pas être littéralement vrai ; sur une puce 4C/8T avec hyperthreading, les cœurs hauts sont des jumeaux SMT — confinés, pas totalement isolés. Là où la plage automatique n'est pas idéale, utilisez le **remplacement manuel** ci-dessous.
5. **La couverture des bandes est limitée par le récepteur.** La configuration RX888 (`sps=60000000` → Nyquist à 30 MHz) ne peut pas atteindre le 6 m et au-delà ; la table des bandes va de 160 m à 10 m. Les autres SDR couvrent ce que permet leur fenêtre d'accord.
6. **Cadence de report.** PSK Reporter envoie toutes les 5 min, wsprnet toutes les 2 min — « 0 sent » les premières minutes est normal, pas un défaut.

### Remplacement manuel de l'épinglage CPU (avancé)

La répartition automatique des cœurs convient à la plupart des machines, mais vous pouvez forcer un épinglage précis là où ce n'est pas le cas (CCX/CCD AMD, ARM big.LITTLE, SMT entrelacé). Deux remplacements indépendants, chacun acceptant une liste de cœurs au format `taskset -c` (`2-3`, `0,2,4`, `0-2,5`) ou `none`/`off`/`unpinned` pour désactiver l'épinglage. Une valeur invalide est ignorée et la déduction automatique s'applique — une faute de frappe ne peut jamais empêcher un lancement.

**Démon autorun** — variable d'environnement `AUTORUN_CORES`, ou champ `"cores"` dans `autorun.json` (l'environnement l'emporte). Le champ `"cores"` est conservé lors du **Save** du panneau d'administration : une modification manuelle persiste donc. Deux façons de le définir :

*Option A — `autorun.json` (persistant, recommandé).* Ajoutez une ligne `"cores"` à la configuration à la racine du dépôt, puis faites **Stop → Start** sur l'onglet Spot Reporting :

```jsonc
// autorun.json
{ "identity": { "callsign": "SV1BTL", "grid": "KM17VX" },
  "reporting": { "pskreporter": true, "wsprnet": false },
  "slots": [ /* … */ ],
  "cores": "2-3" }          // or "none" to run unpinned
```

*Option B — variable d'environnement (ponctuel).* Le démon est lancé par le panneau d'administration : la variable doit donc figurer dans l'environnement **du panneau** — définissez-la et redémarrez le panneau (l'environnement l'emporte sur la valeur d'`autorun.json`) :

```bash
# Méthode A — la variable doit être posée sur le processus qui démarre :
./manage_admin.sh stop && AUTORUN_CORES=2-3 ./manage_admin.sh start

# Méthode B — systemd ignore une variable posée sur la ligne de commande
# systemctl ; placez-la donc dans l'unité :
sudo systemctl set-environment AUTORUN_CORES=2-3
sudo systemctl restart phantomsdr-admin
```

**spectrumserver** — épinglez-le vous-même en préfixant `taskset -c <cœurs>` à la commande que vous utilisez pour démarrer le serveur. Cela fonctionne avec n'importe quelle méthode de démarrage (lancement direct, chaîne SDR, unité de service, etc.) :

```bash
# pin the server to cores 0-3, direct launch:
taskset -c 0-3 ./build/spectrumserver --config <your-config>.toml < <your-input>
# or in an SDR pipeline:
<your-sdr-source> | taskset -c 0-3 ./build/spectrumserver --config <your-config>.toml
```

> ⚠️ **Faites en sorte que cela survive aux redémarrages.** Un `taskset` en ligne ne s'applique qu'à ce lancement précis. Si quelque chose redémarre automatiquement le serveur (chien de garde, service systemd, entrée cron/`@reboot`, …), ajoutez le préfixe `taskset` à l'intérieur du script ou de l'unité qui le lance réellement — sinon le redémarrage perd l'épinglage.

**Vérifier que l'épinglage a pris** — affichez l'affinité CPU réelle des processus en cours :

```bash
taskset -cp "$(pgrep -f 'autorun/index.js')"   # autorun daemon
taskset -cp "$(pgrep -x spectrumserver)"       # spectrumserver
```

**Valeurs acceptées (pour les deux remplacements) :** une liste `taskset -c` (`2-3`, `0,2,4`, `0-2,5`), ou `none`/`off`/`unpinned` pour aucun épinglage. Tout ce qui est mal formé est ignoré et la déduction automatique s'applique : une faute de frappe ne peut donc jamais bloquer le démarrage.

> Sur un Raspberry Pi / toute machine à ≤ 4 cœurs, vous n'avez normalement besoin d'aucun des deux — le chemin automatique exécute déjà les deux processus sans épinglage, ce qui est le bon choix sur un CPU petit et homogène. Le remplacement s'adresse aux machines plus grandes qui ne sont pas des hybrides Intel.

### Fichiers et points de terminaison

| Élément | Objet |
|---|---|
| `autorun.json` | Configuration enregistrée (identité, créneaux, destinations, nombre max de créneaux, remplacement facultatif `cores`). Écrite par l'onglet ; ignorée par git. |
| `autorun-status.json` | État en direct lu par la carte d'état (pid, compteurs, dernier envoi). Écrit toutes les 15 s ; supprimé à l'arrêt. |
| `frontend/dist/autorun-active.json` | Données publiques du badge, servies à `/autorun-active.json`. Vide quand le report est désactivé. |
| `autorun.log` | Sortie standard/erreur du démon. |
| `GET/POST /admin/api/autorun/config` | Lire / écrire `autorun.json` (valide l'indicatif, le locator, les combinaisons bande/mode, la limite de créneaux). |
| `GET /admin/api/autorun/status` | État d'exécution (`pgrep`) + `autorun-status.json`. |
| `POST /admin/api/autorun/start` / `stop` | Lance (`taskset -c <auto> node autorun/index.js`) / envoie `SIGTERM`. La plage de cœurs est déduite du CPU (voir ci-dessus). |

> **Remarque :** après une mise à jour de `admin_server.py`, vous devez [Redémarrer le panneau](#redémarrer-le-panneau) pour charger les nouvelles routes autorun ou une matrice bande/mode actualisée. Le démon s'exécute comme un processus distinct : il survit donc aux redémarrages du panneau d'administration.

---

## Dépannage

| Problème | Correctif |
|---|---|
| Le panneau d'administration ne démarre pas | Consultez `admin.log` — généralement un paquet Python manquant |
| Le proxy ne démarre pas | Exécutez `python3 -c "import aiohttp"` — en cas d'échec : `pip3 install aiohttp --break-system-packages` |
| `proxy.log` est vide | Vérifiez d'abord que le proxy tourne réellement (`./manage_admin.sh status`). Si oui, vous êtes sur une ancienne version : le lanceur doit utiliser `python3 -u` (non tamponné — sinon la bannière de démarrage ne sort jamais du tampon de 8 Ko), et le `main()` de `proxy.py` doit appeler `logging.basicConfig()` (sinon le journaliseur d'accès d'aiohttp n'a pas de gestionnaire et chaque ligne de requête est perdue, car `web.AppRunner` — contrairement à `web.run_app` — ne configure pas la journalisation). |
| Le proxy démarre mais la cascade est vide | Vérifiez `sdr_host` dans `admin_config.json` — normalement `127.0.0.1`. S'il contient encore une ancienne IP LAN d'une version précédente, corrigez-la et [Redémarrer le panneau](#redémarrer-le-panneau) |
| Le bouton Kick indique « no connections » | Exécutez `getcap $(which ss)` — sans `cap_net_admin`, lancez `sudo setcap cap_net_admin+ep $(which ss)` |
| L'état affiche toujours OFFLINE | Allez dans Settings → SDR Process Name — indiquez le nom exact affiché par `ps -eo comm,args \| grep -v grep` |
| La page Users n'affiche aucune donnée | Vérifiez que le point de terminaison fonctionne : `curl http://127.0.0.1:<public_port>/users` |
| Un navigateur externe obtient NetworkError | Vérifiez que le proxy tourne : `./manage_admin.sh status` |
| Le proxy est cassé après un changement réseau | Concerne uniquement le cas où `sdr_host` contient encore une IP LAN — mettez-le à `127.0.0.1` et [Redémarrer le panneau](#redémarrer-le-panneau) |
| Le bouton de suppression du chat n'a aucun effet | Vérifiez les droits d'écriture sur le fichier de journal du chat : `ls -l ~/PhantomSDR-Plus/chat.jsonl` |
| Le message sur la cascade n'apparaît pas | Vérifiez que le proxy tourne (`./manage_admin.sh status`) et que le frontend est sur une version récente incluant le rendu de la superposition |
| Message sur la cascade perdu après un redémarrage | Comportement attendu — l'état du message n'est qu'en mémoire ; renvoyez-le après le redémarrage du panneau |
| Le « Start » de Spot Reporting échoue / le démon se termine aussitôt | Consultez `autorun.log`. C'est généralement le lien symbolique `autorun/node_modules` manquant (`ln -sfn ../frontend/node_modules autorun/node_modules`) ou `taskset` non installé (`sudo apt install -y util-linux`). |
| Spot Reporting : le démon tourne mais `decodes` reste à 0 et `autorun.log` montre `504` / `tap closed 1006` | La prise audio n'atteint pas spectrumserver. Le démon détecte automatiquement le port depuis la configuration du serveur **en cours d'exécution** ; la ligne de journal `[autorun] tap backend: HOST:PORT` doit correspondre à votre `[server] port`. Si elle est fausse (ou si le serveur n'était pas lancé au démarrage), fixez-le dans `autorun.json` : `"server": { "host": "127.0.0.1", "port": 9002 }`, puis Stop→Start. |
| Spot Reporting affiche « 0 sent » | Normal pendant les premières minutes — PSK Reporter envoie toutes les 5 min, wsprnet toutes les 2 min. Vérifiez qu'une destination est activée et que le démon tourne. |
| Les nouvelles bandes/modes n'apparaissent pas dans la matrice | [Redémarrer le panneau](#redémarrer-le-panneau) — la matrice est chargée au démarrage. |
| `autorun.log` affiche `MODULE_TYPELESS_PACKAGE_JSON` / « Reparsing as ES module … performance overhead » | Avertissement cosmétique (le décodage fonctionne toujours). Il manque `"type": "module"` à `frontend/src/modules/package.json` ; ajoutez cette ligne près du début, puis Stop→Start. Aucune recompilation du frontend n'est nécessaire — le démon importe directement le fichier source. |
| Le « Start » de Spot Reporting échoue avec `taskset: … Invalid argument` sur un PC ancien/modeste | Ne devrait pas se produire avec le lanceur tenant compte de la configuration — la plage de cœurs est déduite du nombre de CPU et passe sans épinglage sur ≤ 4 cœurs. Si cela arrive, votre `admin_server.py` est antérieur à ce changement ; mettez-le à jour (`_autorun_taskset_prefix`) et [Redémarrer le panneau](#redémarrer-le-panneau). |
| Le badge REPORTING n'apparaît pas sur la cascade | Le report doit être activé avec au moins un créneau ; le badge lit `/autorun-active.json`. Recompilez le frontend si `dist/index.html` est antérieur au badge. |
