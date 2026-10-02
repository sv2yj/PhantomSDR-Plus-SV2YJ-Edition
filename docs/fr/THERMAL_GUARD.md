# Thermal Guard — Manuel du sysop

**Protection contre la surchauffe du processeur pour PhantomSDR-Plus.**

Un WebSDR est l'une des rares applications qui occupent tous les cœurs, toute la journée, indéfiniment. Si un ventilateur s'encrasse, si une pompe s'arrête ou si la pièce devient brûlante en août, personne ne vous prévient : le serveur continue simplement à décoder jusqu'à ce que le processeur cuise. Le thermal guard est la pièce qui s'en aperçoit et débranche à votre place.

Il est livré **inerte** : d'origine, il n'écrit que dans un journal. Rien n'est protégé tant que vous n'avez pas choisi un mode. Ce manuel porte sur ce choix et sur la façon de vivre avec.

> **Pressé ?** Lancez `python3 thermal_guard.py --once`, lisez les seuils affichés, puis passez `thermal_mode` à `stop+restart` dans le panneau d'administration. C'est tout le travail. Le reste ci-dessous, c'est le *pourquoi*.

---

## Sommaire

1. [Ce qu'il fait](#1-ce-quil-fait)
2. [Démarrage rapide](#2-démarrage-rapide)
3. [Comment il décide](#3-comment-il-décide)
4. [Les quatre modes — ce que chacun fait et ce que vous devez faire](#4-les-quatre-modes)
5. [Choisir un mode](#5-choisir-un-mode)
6. [Référence de configuration](#6-référence-de-configuration)
7. [Fonctionnement sans le panneau d'administration](#7-fonctionnement-sans-le-panneau-dadministration)
8. [Activer l'étage throttle sans root](#8-activer-létage-throttle-sans-root)
9. [Fonctionnement sans surveillance — quand personne ne regarde](#9-fonctionnement-sans-surveillance)
10. [Le tester avant de lui faire confiance](#10-le-tester-avant-de-lui-faire-confiance)
11. [Lire le journal](#11-lire-le-journal)
12. [Lockout et limitation du nombre d'arrêts](#12-lockout-et-limitation-du-nombre-darrêts)
13. [Dépannage](#13-dépannage)
14. [Le désactiver ou le supprimer](#14-le-désactiver-ou-le-supprimer)

---

## 1. Ce qu'il fait

Toutes les 2 secondes, le garde lit la température du die de votre processeur et la compare à quatre seuils. Lorsque la température reste au-dessus de l'un d'eux assez longtemps, il gravit un échelon :

```
   normal  ──►  warn  ──►  throttle  ──►  stop  ──►  (refroidir)  ──►  restart
              ligne dans   baisse de     exécution du   le serveur     exécution du
              le journal   la fréquence  script d'arrêt reste arrêté   script de
                                                                       démarrage
```

Deux choix de conception le rendent utilisable sur la machine de *n'importe quel* sysop, et il vaut la peine de les comprendre avant de compter sur lui :

**Il ne demande jamais comment vous lancez votre serveur.** systemd, une boucle watchdog, cron, tmux, un simple shell : le garde ne le sait pas et s'en moque. À la place, tant que la machine est en surchauffe, il maintient un **lockout** : il réémet l'arrêt à *chaque* cycle. Si votre watchdog relance le serveur, le garde l'arrête à nouveau en moins de deux secondes. Tout ce qui essaie de le maintenir en vie perd, jusqu'à ce que le processeur ait refroidi. C'est ce qui le rend universel, et c'est testé face à un vrai watchdog.

**Il ne code jamais une température en dur.** « Arrêter à 95 °C » est une mauvaise règle : sur un Intel avec Tjmax 100 c'est presque une charge normale, sur un Ryzen c'est *en dessous* de là où Tctl se place sous boost par conception, et sur un Raspberry Pi c'est inatteignable puisque le SoC se limite lui-même à 80. Le garde lit donc le point critique publié par votre propre noyau (`tempN_crit`) et calcule à rebours. Même code, chiffres sensés partout.

---

## 2. Démarrage rapide

**1. Voyez à quoi ressemble votre machine pour le garde.** Toujours en premier :

```
cd ~/PhantomSDR-Plus
python3 thermal_guard.py --once
```

```
sensor     : hwmon:coretemp
temperature: 65.0 C
crit       : 100.0 C
mode       : log
thresholds : warn 88.0  throttle 92.0  stop 95.0  resume 75.0 (C)
cpufreq    : not writable — throttle stage disabled
```

Si `sensor` indique `NONE`, arrêtez-vous ici et lisez le [Dépannage](#13-dépannage) : le garde ne peut pas protéger une machine qu'il ne peut pas mesurer, et il vous le dit plutôt que de faire semblant.

**2. Laissez-le quelques jours en mode `log`.** Il tourne déjà dans le panneau d'administration. Laissez-le observer une semaine normale — après-midi d'été, une grosse compilation, un samedi de concours chargé — et voyez s'il se serait déclenché.

**3. Armez-le.** Panneau d'administration → **Settings** → **THERMAL GUARD** → **MODE** → `stop+restart` → 💾 **SAVE THERMAL SETTINGS**. Effectif en 2 secondes environ ; aucun redémarrage nécessaire.

---

## 3. Comment il décide

### Le capteur

Le garde ne fait confiance qu'aux véritables capteurs de die du processeur :

| Source | Matériel typique |
|---|---|
| `coretemp` | Intel |
| `k10temp`, `zenpower`, `zenpower3` | AMD |
| `cpu_thermal`, `soc_thermal` | Raspberry Pi, cartes ARM |
| Zone thermique `x86_pkg_temp` | solution de repli sur x86 |

`acpitz` et les zones thermiques sans étiquette sont **délibérément exclus**. Sur un ordinateur de bureau classique, `acpitz` affiche environ 28 °C alors que le package du processeur est à 59 °C : un garde qui s'y fierait ne se déclencherait tout simplement jamais. Annoncer « désactivé, aucun capteur fiable » est plus honnête que faire semblant de protéger.

`psutil` est utilisé s'il se trouve installé, mais n'est jamais requis. Le garde n'utilise que la bibliothèque standard.

### Les seuils

Chacun est un écart sous le point critique que la machine publie elle-même :

| Seuil | Écart sous crit | Signification |
|---|---|---|
| warn | −12 °C | Quelque chose ne va pas, le consigner |
| throttle | −8 °C | Tenter de refroidir en ralentissant le processeur |
| stop | −5 °C | Trop près de la limite — arrêter le serveur |
| resume | −25 °C | Vraiment refroidi, retour possible |

Ce qui donne en pratique :

| Votre processeur annonce | warn | throttle | **stop** | resume |
|---|---|---|---|---|
| Intel, crit 100 °C | 88 | 92 | **95** | 75 |
| AMD Ryzen, crit 95 °C | 83 | 87 | **90** | 70 |
| Raspberry Pi, crit 85 °C | 73 | 77 | **80** | 60 |

Si la machine ne publie aucun point critique, le garde se rabat sur un jeu fixe prudent et le signale. Vous pouvez remplacer n'importe quel seuil par une valeur absolue (voir [Référence de configuration](#6-référence-de-configuration)), mais vous ne devriez pas en avoir besoin.

### Temps de maintien — pourquoi un pic ne déclenche jamais rien

Rien ne se produit sur une seule lecture chaude. Un seuil doit être tenu **en continu** :

- **warn** et **throttle** : 30 s (`thermal_warn_sustain_s`)
- **stop** : 60 s (`thermal_sustain_s`)
- **resume** : 300 s sous le seuil de reprise avant un redémarrage (`thermal_resume_s`)

Un pic de compilation, une rafale de décodage, un ventilateur qui monte en régime : tout cela est bien trop bref pour compter. Une seule mesure sous le seuil remet le compteur à zéro. De plus, après le démarrage, le garde exige 3 mesures valides consécutives avant d'agir, et il rejette toute valeur hors de 20–125 °C comme une anomalie de capteur et non comme une température.

---

## 4. Les quatre modes

`thermal_mode` est l'unique interrupteur qui décide jusqu'où le garde a le droit de monter dans l'échelle. Chaque mode **inclut tout ce que font les précédents**.

| Mode | Avertit | Ralentit | Arrête | Redémarre | Le serveur peut-il tomber ? |
|---|:--:|:--:|:--:|:--:|---|
| `log` | ✓ | — | — | — | Non — ne touche à rien |
| `throttle` | ✓ | ✓ | — | — | Non |
| `stop` | ✓ | ✓ | ✓ | — | Oui, reste arrêté jusqu'à votre intervention |
| `stop+restart` | ✓ | ✓ | ✓ | ✓ | Oui, revient tout seul |

---

### `log` — observer et rapporter (valeur d'usine)

**Ce qu'il fait :** tout ce que font les autres modes, sauf agir. Il parcourt toute l'échelle et écrit dans `crash.log` ce qu'il *aurait* fait. Il n'exécute jamais votre script d'arrêt, ne touche jamais à la fréquence du processeur, n'interrompt jamais un auditeur.

**Ce que vous devez faire :** rien — il tourne déjà. Au bout d'une semaine, ouvrez l'onglet **CRASH** du panneau, ou lancez :

```
grep THERMAL crash.log
```

- **Rien du tout ?** Votre refroidissement va bien et vous pouvez armer le garde en confiance.
- **`STOP level reached ... NOT stopping` ?** Le garde aurait éteint votre serveur. C'est un vrai problème thermique avec lequel vous fonctionniez : réparez le refroidissement *et* armez le garde.

**À utiliser quand :** vous venez d'installer le garde et ne connaissez pas encore le comportement de votre machine. C'est un mode de rodage, pas une destination — un garde en `log` ne protège rien.

---

### `throttle` — ralentir le processeur, sans jamais interrompre le service

**Ce qu'il fait :** au seuil de throttle, il abaisse de 20 % la fréquence maximale du processeur, puis la rétablit dès que la température repasse sous la ligne d'avertissement. Votre WebSDR reste en ligne tout du long. Les auditeurs peuvent noter des performances légèrement moindres en forte charge ; la plupart ne verront rien.

Si la température continue malgré tout de grimper au-delà du seuil d'arrêt, ce mode **le consigne et ne fait rien** : il n'arrêtera pas le serveur.

**Ce que vous devez faire :**

1. Donner au garde le droit d'écriture sur la limite de fréquence du processeur — il en a besoin et, par défaut, seul root l'a. Lancez une fois `./setup-cpufreq-perms.sh` ; voir la [section 8](#8-activer-létage-throttle-sans-root).
2. Vérifier avec `python3 thermal_guard.py --once` qu'il affiche `cpufreq : writable, throttle stage available`. S'il indique *not writable*, ce mode ne fait rien de plus que `log`, et il le dira à chaque fois dans le journal.

**À utiliser quand :** vous traquez un problème de refroidissement limite et voulez défendre la machine sans jamais perdre d'auditeurs. **Attention, ce n'est pas une protection complète** : si le ralentissement ne suffit pas, rien d'autre ne se passe. Bon comme première étape, mauvais comme réponse définitive.

---

### `stop` — éteindre le serveur et le laisser éteint

**Ce qu'il fait :** au seuil d'arrêt il exécute votre script d'arrêt, puis maintient le **lockout** : il réarrête le serveur toutes les 2 secondes tant que la machine est en surchauffe, pour que rien ne le relance dans votre dos. Lorsque le processeur est resté 5 minutes sous le seuil de reprise, le lockout se libère. **Le serveur ne revient pas de lui-même.** Vous le relancez quand vous êtes convaincu que la cause est réglée.

**Ce que vous devez faire :**

1. Vous assurer que le garde sait arrêter votre serveur. Dans le panneau, c'est le script d'arrêt configuré (`./stop-websdr.sh` avec les lanceurs fournis). Si aucun n'est défini, le garde se rabat sur `SIGTERM` vers le nom du processus, puis `SIGKILL` après 10 secondes de grâce — cela fonctionne, mais un vrai script d'arrêt est plus propre.
2. Accepter que **votre WebSDR restera hors ligne jusqu'à ce que vous le remarquiez**. Prévoyez un moyen de l'apprendre : une supervision de disponibilité, l'onglet CRASH, ou simplement une vérification quotidienne.

**À utiliser quand :** la machine compte plus que le service, vous êtes généralement sur place, ou un incident thermique est assez sérieux pour que vous vouliez inspecter la machine avant qu'elle reparte. C'est aussi le bon choix si vous ne faites pas confiance à un redémarrage automatique sur votre matériel.

---

### `stop+restart` — arrêter, refroidir, revenir tout seul

**Ce qu'il fait :** tout ce que fait `stop`, et en plus : une fois que le processeur est resté 5 minutes sous le seuil de reprise, il exécute votre script de démarrage et le WebSDR revient de lui-même.

Le battement est évité par `thermal_max_stops_hour` (2 par défaut). Après deux arrêts thermiques en une heure, le garde **désactive le redémarrage automatique** et laisse le serveur arrêté pour que vous regardiez. Notez le détail important : la limite coupe le *redémarrage*, jamais la *protection* — le lockout continue d'arrêter le serveur tant qu'il est chaud, quel que soit le nombre de déclenchements déjà survenus.

**Ce que vous devez faire :**

1. Vous assurer que **les deux** scripts sont configurés et fonctionnent réellement seuls — celui de démarrage comme celui d'arrêt. Testez-les à la main : `./stop-websdr.sh` puis `./start-rx888mk2.sh`.
2. Rien d'autre. C'est le mode qu'on installe et qu'on oublie.

**À utiliser quand :** le WebSDR est public, sans surveillance ou distant — c'est-à-dire la plupart du temps. C'est le mode recommandé pour une installation normale.

---

## 5. Choisir un mode

| Votre situation | Mode |
|---|---|
| Garde tout juste installé, machine encore inconnue | `log` pendant une semaine |
| WebSDR public, sans surveillance, qui doit se débrouiller seul | **`stop+restart`** |
| Site distant difficile d'accès | **`stop+restart`** |
| Vous voulez inspecter la machine après chaque incident thermique | `stop` |
| Matériel auquel vous ne confiez pas un redémarrage automatique | `stop` |
| Refroidissement limite, interdiction de perdre des auditeurs | `throttle`, puis passer à `stop+restart` |
| Machine sans capteur processeur fiable | aucun ne fonctionnera — réglez d'abord le capteur |

Pour la plupart des sysops la réponse est `stop+restart`, et le résumé honnête des autres est : `log` ne protège rien et `throttle` protège un peu.

---

## 6. Référence de configuration

Toutes les clés se trouvent dans `admin_config.json`, à côté de `thermal_guard.py`, et chacune est aussi modifiable dans **Settings → THERMAL GUARD**. Le garde **relit le fichier à chaque cycle**, les changements prennent donc effet en ~2 secondes — sans redémarrage.

| Clé | Défaut | Signification |
|---|---|---|
| `thermal_enabled` | `true` | Interrupteur principal. `false` désactive complètement le garde. |
| `thermal_mode` | `"log"` | `log` \| `throttle` \| `stop` \| `stop+restart` — voir la [section 4](#4-les-quatre-modes). |
| `thermal_warn` | `null` | Seuil d'avertissement absolu en °C. `null` = déduit du point critique. |
| `thermal_throttle` | `null` | Seuil de throttle absolu. `null` = déduit. |
| `thermal_stop` | `null` | Seuil d'arrêt absolu. `null` = déduit. |
| `thermal_resume` | `null` | Seuil de reprise absolu. `null` = déduit. |
| `thermal_sustain_s` | `60` | Secondes de maintien du seuil d'arrêt avant d'arrêter. Minimum 5. |
| `thermal_warn_sustain_s` | `30` | Secondes pour les étages avertissement et throttle. Minimum 5. |
| `thermal_resume_s` | `300` | Secondes sous le seuil de reprise avant libération du lockout. Minimum 30. |
| `thermal_max_stops_hour` | `2` | Arrêts thermiques par heure au-delà desquels le redémarrage automatique est coupé. La protection continue. |
| `thermal_test_temp` | `null` | Fait croire que le processeur est à cette température. Pour les tests uniquement — voir la [section 10](#10-le-tester-avant-de-lui-faire-confiance). |

Le garde autonome utilise en plus `start_script`, `stop_script`, `sdr_process_name` et `sdr_base_dir` du même fichier.

**Remplacer un seuil.** Ne le faites qu'avec une raison. Une courante : votre machine chauffe légitimement pendant les compilations et vous préférez que cela ne compte pas. Relever `thermal_stop` vous donne de la marge au prix de la distance au point critique — ne le mettez jamais au-dessus de votre valeur crit, sinon le processeur atteindra d'abord sa propre coupure d'urgence et le garde deviendra décoratif.

---

## 7. Fonctionnement sans le panneau d'administration

Beaucoup de sysops n'installent jamais le panneau. Le garde fonctionne très bien seul — même fichier, même comportement.

**Essayez-le d'abord au premier plan :**

```
cd ~/PhantomSDR-Plus
python3 thermal_guard.py --once            # que se passerait-il ici ?
python3 thermal_guard.py --mode log        # observer en direct, Ctrl-C pour quitter
```

`--mode` remplace `thermal_mode` depuis la ligne de commande, vous n'avez donc jamais à écrire de JSON à la main :

```
python3 thermal_guard.py --mode stop+restart
python3 thermal_guard.py --config /etc/phantomsdr/thermal.json
```

**Rendez-le ensuite permanent** avec l'unité d'exemple fournie dans le dépôt :

```
sudo cp thermal-guard.service /etc/systemd/system/
sudo nano /etc/systemd/system/thermal-guard.service   # réglez User= et les chemins
sudo systemctl daemon-reload
sudo systemctl enable --now thermal-guard
systemctl status thermal-guard
```

Lisez les commentaires en tête de `thermal-guard.service` avant de l'activer. Deux points comptent le plus :

- **`User=` doit être un compte capable d'exécuter réellement vos scripts de démarrage et d'arrêt.** Faire tourner le garde en root est généralement la mauvaise réponse : il exécuterait aussi ces scripts en root.
- Pointez-le soit vers un `admin_config.json` contenant `start_script` et `stop_script`, soit passez `--mode` sur la ligne `ExecStart`. Une configuration minimale suffit :

```json
{
  "sdr_base_dir": "/home/votreutilisateur/PhantomSDR-Plus",
  "sdr_process_name": "spectrumserver",
  "start_script": "start-rx888mk2.sh",
  "stop_script": "stop-websdr.sh",
  "thermal_mode": "stop+restart"
}
```

Tout ce que fait le garde va toujours dans `crash.log`, à côté de ce fichier de configuration, ainsi que dans le journal systemd (`journalctl -u thermal-guard`).

---

## 8. Activer l'étage throttle sans root

Par défaut, `python3 thermal_guard.py --once` indique :

```
cpufreq    : not writable — throttle stage disabled
```

C'est normal et ce n'est pas un bogue. Le noyau crée

```
/sys/devices/system/cpu/cpuN/cpufreq/scaling_max_freq
```

appartenant à `root:root`, en mode `0644`. Un panneau d'administration exécuté par un utilisateur ordinaire ne peut pas y écrire, le garde saute donc l'étage throttle et le dit dans le journal plutôt que d'échouer en silence.

**La mauvaise solution** consiste à exécuter le garde en root. Il exécute aussi vos scripts de démarrage et d'arrêt, et ceux-ci doivent rester sans privilèges.

**La bonne solution** est de donner le droit d'écriture sur ces fichiers précis à un groupe dédié. Un script s'en charge :

```
cd ~/PhantomSDR-Plus
./setup-cpufreq-perms.sh
```

Il demande votre mot de passe une fois — et une seule, à l'installation — puis :

1. crée un groupe système `cpufreq` et vous y ajoute ;
2. installe `/etc/tmpfiles.d/99-phantomsdr-cpufreq.conf` afin que le groupe et le mode `0664` soient réappliqués **à chaque démarrage** : les droits de sysfs ne survivent pas seuls à un redémarrage ;
3. applique la modification immédiatement, pour que vous puissiez tester sans redémarrer.

Ensuite, dans cet ordre :

```
# 1. déconnectez-vous et reconnectez-vous (ou redémarrez) — un nouveau groupe
#    n'atteint vos processus qu'au travers d'une nouvelle session
id | grep cpufreq

# 2. redémarrez le panneau ; le garde teste le droit d'écriture une fois, au démarrage
sudo systemctl restart phantomsdr-admin
#    (aucune déconnexion nécessaire ainsi — systemd reconstruit la liste des
#     groupes à chaque démarrage. Seulement si les unités ne sont PAS
#     installées : ./manage_admin.sh stop && ./manage_admin.sh start — jamais les deux, elles se
#     disputent le port 3000)

# 3. vérifiez
python3 thermal_guard.py --once
#    cpufreq    : writable, throttle stage available
```

Pour tout annuler : `sudo ./setup-cpufreq-perms.sh --revoke`.

**Remarques**

- L'étage throttle n'*agit* que si `thermal_mode` vaut `throttle` ou plus. Accorder la permission ne change rien en soi.
- Le garde abaisse de 20 % la limite en vigueur à cet instant et rétablit exactement cette valeur. Si vous bridez déjà votre processeur (par exemple via `MAX_SPEED` dans `/etc/init.d/cpufrequtils`), c'est votre bridage qui est rétabli : le garde ne vous rendra pas discrètement une fréquence plus élevée que celle demandée.
- Certaines machines n'exposent aucun pilote cpufreq — de nombreux VPS, la plupart des conteneurs. Le script le détecte et ne change rien. Utilisez-y `stop` ou `stop+restart` ; ils ne dépendent pas de cpufreq.

---

## 9. Fonctionnement sans surveillance

La question la plus fréquente au sujet du garde : *que se passe-t-il quand personne ne regarde ?* La réponse courte est que c'est précisément le cas pour lequel il a été construit.

**Il n'a pas besoin d'un navigateur ouvert.** Le garde est un fil d'exécution en arrière-plan dans `admin_server.py`, cadencé par l'échantillonneur des graphiques toutes les 2 secondes. Il tourne que quelqu'un soit connecté au panneau ou non, qu'un navigateur soit ouvert ou non, que vous soyez éveillé ou non. En mode autonome c'est un service systemd, encore plus indépendant. La carte du tableau de bord est une *fenêtre* sur le garde, pas le garde lui-même.

**Il agit sans demander.** Il n'y a ni boîte de confirmation ni notification à attendre. Au seuil d'arrêt, il arrête le serveur, point. C'est exactement l'objectif.

**Mais seulement si vous lui en avez donné l'autorisation.** En mode `log`, il consignera fidèlement une machine en train de cuire sans rien y faire. Si vous lisez cette section parce que *« je ne suis pas là pour surveiller »*, le mode qu'il vous faut est `stop+restart` : c'est le seul qui protège la machine et remet le service en route sans vous.

**Il ne protège que tant que le panneau est vivant.** Le garde fait partie d'`admin_server.py` : un panneau mort à 02:00 emporte la protection avec lui, et après un redémarrage la machine reste sans surveillance jusqu'à ce que vous vous connectiez pour le relancer. Si personne ne surveille, laissez systemd surveiller : le dépôt fournit `phantomsdr-admin.service` et `phantomsdr-proxy.service`, qui démarrent au boot et relancent le panneau dans les cinq secondes suivant un plantage. Voir [ADMIN_PANEL_SETUP.md](ADMIN_PANEL_SETUP.md). Pour un récepteur non surveillé, c'est **fortement recommandé** : armer `stop+restart` sans cela ne vous protège que jusqu'au prochain redémarrage.

**Comment l'apprendre après coup.** Par ordre d'utilité approximatif :

| Où | Ce que vous obtenez |
|---|---|
| `crash.log` / onglet **CRASH** | Chaque action, horodatée. La trace permanente. |
| Carte **THERMAL GUARD** du tableau de bord | État en direct : température, étage, lockout, arrêts de la dernière heure. |
| Page **Graphs** (température CPU, 24 h) | La forme de l'incident — vitesse de montée, durée du refroidissement. |
| `journalctl -u thermal-guard` | Mode autonome uniquement. |

Une routine raisonnable pour un site sans surveillance : `stop+restart` armé, et `grep THERMAL crash.log` chaque fois que vous vous connectez. Si c'est vide, il n'y a rien à savoir.

**Un exemple concret.** Panne de ventilateur à 03 h 00 sur une machine en `stop+restart` :

```
03:14  la température passe 88 °C, tient 30 s      →  avertissement consigné
03:16  passe 92 °C, tient 30 s                     →  throttle appliqué (si autorisé)
03:19  passe 95 °C, tient 60 s                     →  STOP — script d'arrêt, lockout actif
03:19  le watchdog relance le serveur              →  le garde le rearrête et le consigne
03:26  le CPU est sous 75 °C depuis 5 minutes      →  lockout libéré, script de démarrage
03:41  surchauffe et s'arrête une deuxième fois    →  limite atteinte, plus de redémarrage
                                                      le serveur reste arrêté, la protection reste
```

Vous vous réveillez avec un WebSDR arrêté, un `crash.log` qui dit exactement pourquoi et — surtout — un processeur qui ne s'est jamais approché de son point critique.

---

## 10. Le tester avant de lui faire confiance

N'attendez pas une vraie canicule pour découvrir si votre script d'arrêt fonctionne.

**`thermal_test_temp`** fait croire au garde que le processeur est à la température de votre choix. Tout le reste se comporte parfaitement normalement — les temps de maintien, l'échelle, le lockout, vos vrais scripts.

1. Panneau → **Settings** → **THERMAL GUARD** → **TEST TEMPERATURE**.
2. Saisissez une valeur au-dessus de votre seuil d'arrêt (par exemple `97` sur un Intel).
3. Enregistrez, puis observez la carte du tableau de bord et l'onglet CRASH.
4. **Videz le champ une fois terminé.** Une température de test oubliée signifie que le garde ne lit plus le vrai capteur.

En mode `log`, cela vous montre toute l'échelle sans rien risquer : le premier test sûr, et celui à faire avant d'armer quoi que ce soit.

En mode `stop+restart`, c'est un **test en conditions réelles** : votre serveur va réellement s'arrêter et réellement revenir environ cinq minutes après que vous ayez vidé le champ. Faites-le quand personne n'écoute. Cela vaut la peine une fois, car c'est le seul moyen de savoir que vos scripts d'arrêt et de démarrage fonctionnent lorsqu'ils sont appelés par autre chose que vous.

Équivalents en mode autonome :

```
python3 thermal_guard.py --once                 # seuils seulement, aucune action
python3 thermal_guard.py --mode log             # observer l'échelle en direct
```

---

## 11. Lire le journal

Tout est ajouté à `crash.log`, à côté du fichier de configuration, un évènement par ligne, chacun préfixé par `[THERMAL]` :

```
grep THERMAL crash.log
```

Les lignes sont volontairement sur une seule ligne et exploitables par grep. Ce que vous verrez :

| Ligne | Signification |
|---|---|
| `warn: 88.4C (warn=88.0 crit=100) sustained 30s` | Premier échelon. Rien n'a été fait. |
| `throttle: 92.1C sustained 30s — cpufreq max lowered 20%` | Fréquence processeur réduite. |
| `throttle level reached: ... (no cpufreq write access — stage skipped)` | Voir la [section 8](#8-activer-létage-throttle-sans-root). |
| `STOP level reached: ... mode is 'log', NOT stopping` | Il aurait arrêté le serveur. Armez-le. |
| `STOPPED server: 95.2C sustained 60s (stop=95.0 crit=100) — ran stop-websdr.sh` | Le cas réel. |
| `lockout: process reappeared at 96.0C — re-stopped (...) [12 time(s) so far]` | Quelque chose relance votre serveur ; le garde gagne. Limité à une ligne par minute. |
| `rate limit: 2 thermal stops within the hour — automatic restart is now DISABLED` | Reste arrêté pour que vous enquêtiez. La protection continue. |
| `recovered: 54.0C held below 75.0 — lockout cleared` | De nouveau froid. |
| `auto-restart: ran start-rx888mk2.sh` | De retour en ligne. |
| `back to normal: 59.0C (warn=88.0)` | Redescendu de l'échelle sans jamais s'arrêter. |

---

## 12. Lockout et limitation du nombre d'arrêts

Ce sont les deux comportements qui surprennent le plus, autant les énoncer clairement.

**Le lockout** est ce qui fait fonctionner le garde face à *votre* installation en particulier. Quand il arrête le serveur, il ne se contente pas d'émettre un arrêt en espérant. Il se marque verrouillé et, à chaque cycle de 2 secondes tant que la température dépasse le seuil de reprise, il vérifie si le processus est revenu — et si c'est le cas, il l'arrête de nouveau. Votre watchdog, le `Restart=always` de systemd, une tâche cron, un sysop impatient : tous perdent cette discussion jusqu'au refroidissement du processeur. Il se libère automatiquement dès que la température est restée sous le seuil de reprise pendant `thermal_resume_s` (5 minutes par défaut).

**Le bouton CLEAR LOCKOUT** de la carte du tableau de bord libère le lockout *et* le compteur d'arrêts par heure, pour les cas où vous avez réparé le refroidissement et ne voulez pas attendre. Il **ne désarme pas** le garde : si la machine est encore chaude, la vérification suivante arrêtera de nouveau le serveur. C'est voulu.

**La limitation** (`thermal_max_stops_hour`, 2 par défaut) empêche une machine défaillante de faire des allers-retours toute la nuit. Une fois la limite atteinte, le garde **désactive le redémarrage automatique** et laisse le serveur arrêté. Lisez bien : il désactive le redémarrage, pas la protection. Le lockout continue de rearrêter le serveur tant qu'il est en surchauffe, quel que soit le nombre de déclenchements déjà survenus. Un garde qui se tairait précisément au pire moment pour la machine serait pire que pas de garde du tout.

---

## 13. Dépannage

**`sensor : NONE — no trusted CPU sensor on this machine`**
Le garde n'a trouvé aucun capteur de la liste autorisée et refuse de deviner. Essayez `sensors` (paquet `lm-sensors` ; `sudo apt install lm-sensors && sudo sensors-detect`). Dans une machine virtuelle ou un conteneur, il n'y a souvent réellement aucun capteur de die exposé : le garde ne peut pas protéger cette machine et se déclare désactivé plutôt que de faire semblant.

**`cpufreq : not writable — throttle stage disabled`**
Attendu tant que vous n'avez pas lancé `./setup-cpufreq-perms.sh` — voir la [section 8](#8-activer-létage-throttle-sans-root). Cela n'affecte que l'étage throttle ; `stop` et `stop+restart` ne sont pas concernés.

**J'ai lancé `setup-cpufreq-perms.sh`, il dit toujours not writable**
Deux causes probables : vous ne vous êtes pas déconnecté puis reconnecté depuis (un nouveau groupe n'atteint les processus qu'au travers d'une nouvelle session — vérifiez avec `id`), ou le panneau n'a pas été redémarré depuis (le garde teste le droit d'écriture une fois, au démarrage). Faites les deux, dans cet ordre.

**Les seuils semblent faux pour mon processeur**
Vérifiez ce que publie la machine : `cat /sys/class/hwmon/hwmon*/temp*_crit`. Si votre crit est inhabituel, ou absent, mettez des valeurs absolues dans `thermal_stop` et compagnie.

**Il a arrêté mon serveur alors qu'il ne me semblait pas chaud**
Vérifiez si `thermal_test_temp` est resté défini depuis un test. C'est de loin la cause la plus fréquente.

**Il ne se déclenche jamais alors que la machine chauffe**
Vérifiez que le mode n'est pas `log`, que `thermal_enabled` vaut `true`, et comparez la température observée aux seuils donnés par `--once`. Rappelez-vous que le seuil doit être dépassé *en continu* pendant tout le temps de maintien.

**Le serveur n'arrête pas de redémarrer pendant un incident thermique**
C'est le lockout qui fonctionne, et les lignes `lockout:` sont son rapport de réussite : votre superviseur continue d'essayer, le garde continue de défaire. Rien à corriger.

**Le panneau ne tourne pas, le garde tourne-t-il ?**
Non — en mode panneau, le garde vit dans `admin_server.py`. Si vous voulez une protection indépendante du panneau, utilisez le service autonome de la [section 7](#7-fonctionnement-sans-le-panneau-dadministration).

---

## 14. Le désactiver ou le supprimer

- **Le mettre en pause :** passez `thermal_mode` à `log`. Il continue d'observer et de rapporter, sans jamais agir.
- **Le désactiver complètement :** passez `thermal_enabled` à `false`.
- **Autonome :** `sudo systemctl disable --now thermal-guard`.
- **Annuler les droits cpufreq :** `sudo ./setup-cpufreq-perms.sh --revoke`.

Supprimer `thermal_guard.py` est également sans danger — `admin_server.py` l'importe dans un `try` et signale simplement le garde comme indisponible s'il manque.

---

## Voir aussi

- [Installation du panneau d'administration](ADMIN_PANEL_SETUP.md#thermal-guard) — l'onglet Thermal Guard dans son contexte
- [Installation](INSTALLATION.md#protection-thermique-du-processeur) — protection thermique lors d'une installation neuve
- [Structure du projet](PROJECT_STRUCTURE.md) — où se trouve `thermal_guard.py`
