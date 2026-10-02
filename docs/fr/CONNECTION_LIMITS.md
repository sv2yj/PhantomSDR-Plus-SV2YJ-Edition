# Limites de connexion — Manuel du sysop

**Protéger un récepteur public contre les afflux de connexions.**

Un WebSDR est un service public qui remet à quiconque le demande un flux continu d'audio et de spectre. C'est tout son intérêt, et c'est aussi le problème : pour le serveur, rien ne distingue un auditeur normal de quelqu'un qui ouvre des sessions en boucle. Le 16 septembre 2026, ce récepteur a subi exactement cela — une seule adresse a ouvert 134 sessions d'écoute en une minute et en a maintenu 181 simultanément, alors que le public réel de la station tournait autour d'une douzaine.

Ce manuel traite des trois couches qui l'arrêtent, de ce que chacune peut et ne peut pas faire, et de la manière de savoir si les vôtres sont raisonnablement réglées.

> **Pressé ?** Le `config.toml` d'exemple est déjà livré avec des valeurs sensées : une installation neuve est donc protégée sans que vous fassiez quoi que ce soit. Si votre propre `.toml` est plus ancien et ne comporte pas de clés `[limits]` au-delà de `audio`/`waterfall`/`events`, les limites par adresse sont tout simplement **désactivées** — copiez le bloc depuis l'exemple pour les activer. La seule commande à connaître ensuite est `grep Refused spectrumserver.log`, qui vous dit si quelqu'un se fait refuser.

---

## Sommaire

1. [Contre quoi vous vous défendez réellement](#1-contre-quoi-vous-vous-défendez-réellement)
2. [Les trois couches](#2-les-trois-couches)
3. [Limites par adresse — la politique des auditeurs](#3-limites-par-adresse)
4. [Connexions inactives — l'attaque silencieuse](#4-connexions-inactives)
5. [La protection au niveau du noyau — `setup-firewall.sh`](#5-la-protection-au-niveau-du-noyau)
6. [Référence de configuration](#6-référence-de-configuration)
7. [Ce que voit un auditeur refusé](#7-ce-que-voit-un-auditeur-refusé)
8. [Lire les journaux et les compteurs](#8-lire-les-journaux-et-les-compteurs)
9. [Choisir vos nombres](#9-choisir-vos-nombres)
10. [Pièges à connaître](#10-pièges-à-connaître)
11. [Tout désactiver](#11-tout-désactiver)

---

## 1. Contre quoi vous vous défendez réellement

Il vaut la peine d'être précis, car le mot « DDoS » recouvre deux choses très différentes et une seule d'entre elles peut se régler sur votre propre machine.

**Afflux d'une source unique.** Une machine, ou une poignée, ouvrant des connexions aussi vite qu'elle le peut. C'est ce qui s'est produit ici, et cela se corrige entièrement : les connexions arrivent d'une adresse que l'on peut compter, et compter suffit.

**Une véritable attaque distribuée.** Des milliers de machines, souvent avec des adresses source falsifiées, qui saturent votre lien. Quand ces paquets atteignent votre carte réseau, la bande passante est déjà dépensée. **Rien de ce que décrit ce manuel n'aide**, et rien de ce que vous installez sur le serveur ne le peut — la seule réponse est un service en amont de vous, ce qui est une autre discussion, impliquant un vrai domaine et un fournisseur comme Cloudflare devant le récepteur.

Tout ce qui suit traite du premier cas. Ce n'est pas une limite dont il faille s'excuser : le premier cas est ce qui arrive réellement aux stations d'amateur.

---

## 2. Les trois couches

```
   l'internet
        │
        ▼
   ┌─────────────────────────────────────────────────────────┐
   │  1. nftables          setup-firewall.sh                 │
   │     grossier, peu coûteux, écrête le volume avant que   │
   │     quoi que ce soit ne le lise                         │
   └─────────────────────────────────────────────────────────┘
        │
        ▼
   ┌─────────────────────────────────────────────────────────┐
   │  2. spectrumserver    [limits] dans config.toml         │
   │     exact, par auditeur, sait qui est qui               │
   └─────────────────────────────────────────────────────────┘
        │
        ▼
   ┌─────────────────────────────────────────────────────────┐
   │  3. le navigateur     dit pourquoi, et ne réessaie jamais │
   └─────────────────────────────────────────────────────────┘
```

Elles ne sont délibérément pas redondantes. La couche noyau est rapide mais bête — elle compte les paquets venant d'une adresse et ne sait rien des auditeurs. La couche serveur est précise mais ne voit une connexion qu'une fois acceptée et analysée, ce qui coûte quelque chose. La couche navigateur existe pour qu'un auditeur refusé sache ce qui s'est passé, au lieu de fixer une page qui ne charge jamais.

---

## 3. Limites par adresse

### Ce qui compte pour un auditeur

Un auditeur, c'est **une connexion `/audio`** — ou, là où `[kiwi_emulation]` est activé, **une connexion son Kiwi**, qui compte exactement pareil. C'est la même unité que celle qu'utilisent déjà le compteur d'utilisateurs, `users.json` et les étiquettes sur la cascade : un client Kiwi occupe donc une place et apparaît dans la liste des utilisateurs comme un navigateur.

Cela compte, car un seul onglet de navigateur sur ordinateur ouvre **quatre** connexions vers votre serveur :

| Connexion | Rôle |
|---|---|
| `/audio` | le flux audio démodulé — **c'est lui, l'auditeur** |
| `/waterfall` | l'affichage du spectre |
| `/events` | liste des utilisateurs, fréquences des autres auditeurs |
| `/chat` | le panneau de discussion |

Un téléphone sur `/mobile` en ouvre deux (`/audio` et `/chat`), car il n'a pas de cascade. Une limite qui compterait les connexions brutes refuserait donc tout le monde : trois onglets, cela fait douze connexions.

### Les trois clés

```toml
[limits]
per_ip=3            # auditeurs simultanés depuis une adresse
per_ip_sockets=0    # connexions simultanées de tout type ; 0 donne per_ip * 4 + 4
per_ip_rate=40      # nouvelles connexions par minute depuis une adresse
per_ip_ban_s=600    # durée de refus d'une adresse qui dépasse le débit
```

**`per_ip`** est le nombre principal, celui auquel vous penserez. Trois est un bon point de départ.

**`per_ip_sockets`** existe parce que `/audio` n'est pas la seule chose qu'il vaille la peine d'inonder. `/waterfall` est le flux le plus lourd que produit votre serveur, et une limite qui ne compterait que les auditeurs se contournerait en ouvrant simplement des connexions de cascade. Laissé à `0`, il devient `per_ip * 4 + 4`, ce qui loge `per_ip` onglets complets avec un peu de marge pour les connexions que le noyau n'a pas encore recyclées après un rechargement de page.

**`per_ip_rate`** est ce qui met réellement fin à un afflux. Le plafond seul n'y suffit pas : refuser une connexion est peu coûteux mais pas gratuit, et un attaquant peut se reconnecter aussi vite que les refus reviennent, en brûlant votre processeur en montages et démontages. La limite de débit lui donne un blocage au lieu d'une réponse. Rappelez-vous qu'un onglet coûte quatre : 40/minute, c'est environ dix chargements de page par minute depuis une adresse.

> **Un ordre délibéré.** Le débit est débité *avant* que le plafond de simultanéité ne soit testé. Cela semble à l'envers jusqu'à ce qu'on pense à une adresse déjà à son plafond et qui se reconnecte en boucle : si le refus bon marché « tu es au plafond » lui répondait à chaque fois, les infractions de débit ne s'accumuleraient jamais et le blocage qui met fin à la boucle ne se déclencherait jamais.

### Qui est exempté

**La boucle locale n'est jamais limitée.** Le tap autorun pour les rapports de spots, le panneau d'administration et un navigateur ouvert sur la machine du serveur elle-même arrivent tous depuis `127.0.0.1`, et les laisser consommer des places reviendrait à ce que votre propre station enferme dehors vos auditeurs.

Cela couvre aussi `proxy.py` : les connexions passant par le proxy atteignent `spectrumserver` depuis la boucle locale, et l'adresse réelle du client arrive dans l'en-tête `X-Forwarded-For`, sur lequel les limites sont indexées.

---

## 4. Connexions inactives

Il existe une attaque qu'aucun des mécanismes ci-dessus ne peut voir.

Ouvrir une connexion TCP. Ne rien envoyer. La garder.

Un tel interlocuteur ne complète jamais de requête : il n'atteint donc jamais le code où vivent les limites par adresse — pas d'auditeur, pas d'objet client, rien qui porte un nom que l'on puisse compter. Pendant ce temps, cela lui coûte quelques octets et vous coûte un descripteur de fichier et une place tant qu'elle est tenue.

```toml
[limits]
idle_per_ip=8       # connexions inactives (avant requête) par adresse
idle_total=512      # plafond toutes adresses confondues
```

La limite porte sur le **combien**, pas sur le **combien de temps**, et cette distinction fait toute la conception. **Il n'y a aucun délai sur une connexion inactive, et c'est délibéré.** Un délai semble la réponse évidente et c'est un piège (voir [§10](#10-pièges-à-connaître)) : il existe des interlocuteurs légitimes qui se connectent puis restent silencieux longtemps avant de parler. Ce qui les sépare d'une attaque, c'est la quantité — un interlocuteur légitime tient une telle connexion, un attaquant en tient des milliers.

Une connexion inactive vit donc jusqu'à ce qu'elle fasse une requête ou qu'elle meure, et sa place est rendue dans les deux cas.

`idle_total` borne un afflux réparti sur de nombreuses adresses source. Une fois le plafond atteint, ce sont les **nouvelles** connexions inactives qui sont refusées plutôt que les existantes évincées : une connexion légitime et de longue durée n'est donc jamais ce que l'on sacrifie pour faire de la place.

Les deux s'appliquent au moment où la socket est acceptée, à partir de l'adresse du pair — il n'y a pas encore de requête, donc pas de `X-Forwarded-For` à consulter. Ce n'est pas gênant : la boucle locale n'est pas comptée, ce qui couvre tout ce qui arrive par `proxy.py`, et un afflux direct porte sa propre adresse.

---

## 5. La protection au niveau du noyau

`setup-firewall.sh` installe une table nftables qui écrête le volume avant que `spectrumserver` n'en lise le moindre octet. Elle est délibérément grossière, et ses nombres se situent bien au-dessus de ceux de `config.toml`, afin qu'un auditeur normal ne puisse jamais être pris par les deux.

```bash
./setup-firewall.sh --show        # afficher les règles, ne rien changer
sudo ./setup-firewall.sh --check  # valider vis-à-vis de votre noyau
sudo ./setup-firewall.sh --apply  # charger, avec retour arrière automatique à 60 s
sudo ./setup-firewall.sh --persist # recharger au démarrage
sudo ./setup-firewall.sh --status  # les compteurs de paquets par règle
sudo ./setup-firewall.sh --remove  # tout annuler
```

Elle couvre quatre choses : un plafond de connexions simultanées par adresse source sur vos ports de proxy et de récepteur, un débit de nouvelles connexions par source, un frein contre la force brute SSH, et le partage de fichiers Windows fermé à tout ce qui se trouve hors des plages d'adresses privées — `smbd` écoute sur `0.0.0.0` sur bien des machines, et son accessibilité depuis l'extérieur dépend d'un routeur que le script ne peut pas voir.

Les ports sont lus dans `admin_config.json`, le fichier même qu'utilise `proxy.py` : la configuration suit donc la vôtre.

### Pourquoi elle ne peut pas vous enfermer dehors

Deux propriétés, toutes deux délibérées :

- La politique de la table est **accept**, et elle ne rejette que des motifs nommés précis. Une règle qui ne correspond pas laisse passer le paquet vers ce que vous avez configuré par ailleurs. Elle ne peut pas rendre la machine injoignable.
- **Les connexions établies sont acceptées dès la toute première règle.** La session SSH dans laquelle vous tapez n'est jamais affectée par ce qui suit.

Par-dessus cela, `--apply` arme un retour arrière automatique : charger les règles, puis confirmer dans les 60 secondes, faute de quoi elles sont retirées. Ne dites rien, fermez le terminal, perdez votre connexion — le jeu de règles disparaît de lui-même.

Utilisez bien cette fenêtre. Vérifiez **depuis un autre appareil, hors de votre propre réseau**, que le récepteur charge toujours et qu'une *nouvelle* session SSH s'ouvre. Tester avec la session que vous avez déjà ne prouve rien, puisqu'elle a été acceptée par la règle un.

---

## 6. Référence de configuration

Chaque clé ci-dessous vit sous `[limits]` dans votre fichier `.toml`. **Toutes sont par défaut désactivées ou généreuses** : une configuration qui ne les mentionne pas se comporte donc exactement comme avant.

| Clé | Défaut | Signification |
|---|---|---|
| `per_ip` | `0` (désactivé) | Auditeurs simultanés par adresse |
| `per_ip_sockets` | `0` → `per_ip * 4 + 4` | Connexions simultanées de tout type par adresse |
| `per_ip_rate` | `0` (désactivé) | Nouvelles connexions par minute et par adresse |
| `per_ip_ban_s` | `600` | Secondes de refus après dépassement du débit |
| `idle_per_ip` | `8` | Connexions inactives, avant requête, par adresse |
| `idle_total` | `512` | Connexions inactives toutes adresses confondues |

Mettre n'importe quelle clé à `0` désactive ce contrôle précis.

### Les trois qui ne sont pas des limites

`[limits]` contient aussi `audio`, `waterfall` et `events`, héritées du PhantomSDR d'origine, et **aucune des trois n'est appliquée.** `waterfall` et `events` ne sont lues par aucun code. `audio` est lue en un seul endroit : elle est envoyée comme `max_users` dans le JSON d'enregistrement aux annuaires de `[websdr] register_urls`, c'est donc le chiffre qu'affichent sdr-list.xyz et les autres, et elle ne fait absolument rien lorsque `register_online=false`. Si vous voulez un plafond d'auditeurs, c'est `per_ip` plus haut qui agit.

### Une de plus, sous `[server]`

```toml
[server]
min_client_version=0
```

Ce n'est pas une limite mais un refus, et comme il partage le même code de fermeture, sa place est ici. Les pages annoncent la version depuis laquelle elles ont été chargées sous la forme `/audio?v=N`, et tout ce qui est en dessous de `min_client_version` est éconduit avec *« cette page est périmée — veuillez la recharger »*.

Cela existe parce que le serveur ne peut pas atteindre du JavaScript qui tourne déjà dans le navigateur de quelqu'un. Un onglet conserve le code qu'il a chargé jusqu'à ce que quelqu'un le recharge : une modification de la page n'atteint donc que les auditeurs qui rechargent par hasard — et une station qui vient de changer le comportement des sessions peut avoir besoin que les anciennes pages disparaissent maintenant, et non un jour.

Seul `/audio` est vérifié, car c'est là que vit une session, et la boucle locale ainsi que les chemins Kiwi sont exemptés afin que le tap autorun et les clients Kiwi ne soient pas touchés. `0` le désactive et c'est la valeur par défaut. Le laisser actif une fois les anciennes pages écoulées ne pose pas de problème : un client de diversité actuel refusé sur un `/audio` nu réessaie avec le marqueur, si bien que seuls restent éconduits les clients de diversité d'une version plus ancienne de PhantomSDR-Plus et les outils tiers qui ouvrent `/audio` sans `?v=`. Remettez-le à `0` si une autre station signale qu'elle ne peut plus vous utiliser comme partenaire de diversité.

---

## 7. Ce que voit un auditeur refusé

### Rien ne se reconnecte jamais

Commencez par là, car cela gouverne tout le reste : **une connexion `/audio` qui tombe met fin à la session.** Il n'y a pas de reconnexion automatique, et c'est voulu.

Se reconnecter est le bon réflexe pour une application de discussion et le mauvais pour un récepteur. `/waterfall` et `/events` ne revenaient jamais avec elle : une session réessayée était donc une connexion audio vivante boulonnée à une cascade figée ; et arrêter le serveur ne le vidait plus, puisque chaque auditeur était de retour quelques secondes plus tard, remplissant la liste d'utilisateurs de sessions où en réalité personne ne se trouvait. La page se tait et l'auditeur la recharge — ce que faisait précisément ce récepteur avant qu'une reconnexion n'y soit ajoutée.

Pour les limites de ce manuel, cela supprime aussi un piège : face à une limite de débit, une tentative automatique prolongerait justement le blocage qu'elle cherchait à contourner.

### Les deux codes de fermeture

| Code | Signification | Qui l'envoie |
|---|---|---|
| **4003** | refusé — au-delà d'une limite par adresse, ou page périmée | `spectrumserver` |
| **4001** | exclu par le sysop | `spectrumserver`, quand le panneau appelle `/~~kick` |

Tous deux sont dans la plage privée 4000–4999, aucun ne peut donc être confondu avec un état de protocole, et tous deux sont tenus pour définitifs par toutes les pages. Le texte du motif voyage dans la trame de fermeture plutôt qu'en message, car la première trame sur `/audio` est réservée aux réglages du récepteur et tout ce qui serait envoyé avant casserait toute connexion normale.

### Sur la page

**Refusé au chargement de la page** — l'auditeur ne démarre même pas, les deux pages s'expliquent donc. Le bureau affiche un panneau : *« Ce récepteur a refusé la connexion »*, le motif, et la note que tous ceux qui partagent un accès internet comptent pour une seule adresse. `/mobile` affiche la même chose dans sa zone d'avis.

**Refusé ou exclu en cours de session** — la page de bureau s'arrête simplement, délibérément sans message : la boucle de dessin de la cascade s'interrompt, et c'est tout. `/mobile` affiche une ligne invitant l'auditeur à recharger, sauf après une exclusion, où elle reste silencieuse elle aussi.

Ce silence après une exclusion est intentionnel. **Exclure, c'est le sysop qui met fin à une session, ce n'est pas une punition** — rien n'est annoncé, et qui veut revenir recharge la page et redevient un auditeur ordinaire une seconde plus tard. Tout ce qu'apporte le code 4001, c'est que le navigateur sache qu'il ne s'agissait pas d'une connexion tombée : l'exclusion prend donc effet au lieu de s'annuler d'elle-même.

L'exclusion est faite par `spectrumserver` lui-même, et non par `proxy.py` : les auditeurs se connectent directement au port du récepteur, le proxy ne possède donc aucune de leurs connexions et son exclusion n'atteint personne. Le panneau appelle `/~~kick?ip=&secs=`, joignable en boucle locale seulement et vérifié sur le vrai pair TCP, non sur `X-Forwarded-For`, que le client fournit. `secs` vaut zéro par défaut — aucun bannissement — mais accepte une durée si vous voulez garder l'adresse dehors un moment, et cela réutilise le mécanisme de bannissement de `per_ip_rate`, si bien que la reconnexion est refusée à la porte.

## 8. Lire les journaux et les compteurs

### Le serveur

```bash
grep Refused spectrumserver.log
```

```
Refused /audio from 203.0.113.5: too many simultaneous connections
Refused /audio from 198.51.100.7: too many connection attempts
```

S'il n'y a rien, personne n'est refusé. La journalisation est limitée à au plus une ligne par adresse toutes les cinq secondes — sans cela, une attaque se transformerait en écritures disque sans borne, ce qui n'est qu'une façon plus lente de faire tomber la station.

### Le noyau

```bash
sudo ./setup-firewall.sh --status
```

Lisez le **`counter packets N`** de chaque règle ; c'est le nombre réellement rejeté. Tout à zéro signifie que rien n'a été bloqué et que vos seuils sont confortablement larges.

Ne vous alarmez pas des listes `elements = { ... }` dans les ensembles au-dessus des règles. Ce sont vos auditeurs ordinaires *suivis* par rapport aux limites — une entrée apparaît à la première connexion d'une adresse et expire une ou deux minutes plus tard. Suivre n'est pas bloquer.

---

## 9. Choisir vos nombres

Deviner est inutile ; vos propres journaux vous le diront. Voici la mesure qui a fixé ici `per_ip=3`, sur une semaine de `logs/users_*.jsonl` :

| Sessions simultanées depuis une adresse | Nombre d'adresses |
|---|---|
| 1 | 682 |
| 2 | 54 |
| 3 | 13 |
| plus de 3 | **8** |

758 adresses distinctes en sept jours, et une limite de trois en aurait touché huit. L'afflux, lui, était à 181.

Pour refaire la mesure sur votre propre station, appariez les identifiants de session par adresse dans `logs/users_*.jsonl` et prenez le recouvrement maximal. Notez que le journal enregistre des événements `tune` et `disconnect` mais n'a pas d'événement `connect` : le début d'une session doit donc être déduit de son premier `tune`.

**N'oubliez pas le NAT.** Un club, une école, un bureau ou un opérateur mobile apparaissent comme une adresse unique, et tous ceux qui sont derrière partagent un même quota. C'est inhérent à toute limite indexée sur une adresse ; la seule atténuation est de choisir un nombre qui vous convienne. Si un auditeur signale un jour ne pas pouvoir se connecter, c'est la première chose à soupçonner — regardez `grep Refused` avant toute autre chose.

---

## 10. Pièges à connaître

### Jamais de délai sur une connexion inactive

Il n'y a plus de réglage `handshake_s`, et voici pourquoi. Un délai de 30 secondes sur les connexions inactives a l'air de la défense évidente contre un slowloris. Il a été écrit, activé, et a produit ceci en une minute :

```
Idle deadline: closed 1 connection(s) idle past 30s: 192.87.173.88
```

`192.87.173.88`, c'est `etgd-websdr.ewi.utwente.nl` — **la machine de rappel de websdr.org elle-même**. Elle se reconnecte vers votre serveur puis reste inactive, bien plus de 30 secondes, avant d'envoyer son `GET /~~orgstatus`. Le délai la coupait à chaque fois et l'enregistrement s'est arrêté. Le réglage a été supprimé plutôt que laissé en option : une arme qui se retourne contre vous et casse votre fiche d'annuaire ne vaut pas les soixante lignes qui l'implémentent.

**Le même raisonnement vaut pour `open_handshake_timeout` de websocketpp, qui est toujours là.** La valeur de dix minutes dans `spectrumserver.cpp` paraît absurde et elle est porteuse : c'est elle qui permet au rappel de websdr.org de rester inactif. Il y a une seconde raison — le gestionnaire de `/~~orgstatus` répond depuis un fil qui détient un `dup()` de la socket, et websocketpp termine une connexion expirée par `shutdown()`, un appel au niveau de la socket qui traverse le duplicata et casserait le rappel même si le temps d'inactivité n'était pas en cause.

S'il faut borner les connexions silencieuses, bornez leur nombre, pas leur âge. C'est exactement ce que sont `idle_per_ip` et `idle_total`.

### Un fichier nftables doit être idempotent

`nft -f` **ajoute** à une table déjà existante au lieu de la remplacer. Un fichier de règles sans préambule `delete table` double donc toute la chaîne à chaque rechargement — ce que fait précisément une unité systemd naïve à chaque redémarrage du service. `setup-firewall.sh` produit le préambule pour vous ; si vous écrivez vos propres règles, faites de même.

```bash
sudo ./setup-firewall.sh --status | grep -c dport   # doit donner 8, pas 16
```

---

## 11. Tout désactiver

Les limites du serveur : mettez les clés à `0`, ou effacez-les de votre `.toml`, puis redémarrez le récepteur. Il n'y a pas d'autre état ; rien ne survit à un redémarrage.

Le pare-feu :

```bash
sudo ./setup-firewall.sh --remove
```

Cela supprime la table, retire le jeu de règles enregistré et désactive le service de démarrage. Votre machine revient exactement dans l'état où elle était avant — ce qui, sur la plupart des installations, signifie aucun pare-feu du tout. Cela mérite réflexion avant de le retirer.
