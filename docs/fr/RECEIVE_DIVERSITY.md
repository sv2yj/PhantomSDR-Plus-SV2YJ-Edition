# PhantomSDR-Plus — Diversité de réception

Associez votre récepteur à un **second récepteur situé ailleurs** et écoutez celui des deux qui a, à cet instant, le meilleur signal. Quand l'un des sites tombe dans un évanouissement, l'autre en général non, et la copie continue.

Le second récepteur peut être un autre PhantomSDR-Plus, un KiwiSDR, un UberSDR ou un WebSDR. Pour les trois premiers, tout s'exécute dans le navigateur : aucune modification du serveur, aucun fichier de configuration, rien à installer et aucun accès particulier à l'autre récepteur. Le WebSDR fait exception et demande un petit programme sur votre propre serveur — voir [Utiliser un WebSDR](#utiliser-un-websdr) plus bas.

---

## Ce que cela fait, et ne fait pas

Ici, diversité signifie **sélection** : à chaque instant vous écoutez l'un ou l'autre site, avec un bref fondu au changement. Ce n'est pas un réseau d'antennes en phase et les deux signaux ne sont pas additionnés.

C'est un choix délibéré, et la raison relève de la physique, pas du logiciel. Deux récepteurs distants de centaines de kilomètres entendent la même émission par des trajets ionosphériques différents. Les deux formes d'onde arrivent avec des phases sans rapport et un Doppler légèrement différent ; les additionner donne un son creux, filtré en peigne — l'effet « phasey » bien connu. Une vraie combinaison cohérente exige deux récepteurs sur une **horloge commune**, alignés à l'échantillon ; deux récepteurs indépendants reliés par internet ne pourront jamais l'offrir.

Ce que l'on gagne est donc de la **continuité, pas de la puissance de signal** :

- Sur un trajet stable où un récepteur est simplement meilleur, vous entendrez celui-là et ne gagnerez rien. C'est normal.
- Sur un trajet à QSB profond, les évanouissements de deux sites éloignés sont largement décorrélés. Le site A disparaît trois secondes, le site B non, et l'audio continue. Attendez-vous à *« j'ai cessé de perdre des mots »*, pas à *« on est passé de S3 à S7 »*.
- Le second bénéfice tient souvent au **bruit local et au QRM**. Deux sites ont des voisins différents, des réseaux électriques différents et des éclaboussures différentes. Sur une bande bruyante, cela peut compter davantage que l'évanouissement.

Il y a un prix : vous écoutez **avec une à trois secondes de retard**, car le flux en avance doit être retardé pour coïncider avec l'autre. Sans importance pour l'écoute et le décodage, gênant si vous cherchez à trafiquer.

> [!NOTE]
> Les décodeurs numériques (FT8, JS8, WSPR, RADE et les autres) continuent délibérément d'utiliser votre récepteur **local**, pas l'audio combiné. Ces modes intègrent de façon cohérente sur tout un intervalle, et changer de site au milieu d'un intervalle constitue une discontinuité de phase qui peut vous coûter précisément le décodage que la diversité devait sauver. La diversité sert le haut-parleur ; les décodeurs conservent le flux local continu.

---

## Prise en main rapide

1. Ouvrez le panneau **Receive Diversity** — il se trouve juste en dessous des fenêtres de décodeurs, replié, affichant `Receive Diversity — off`. Cliquez pour le déplier.
2. Choisissez ce qu'est le second récepteur : **PhantomSDR+**, **KiwiSDR**, **UberSDR** ou **WebSDR**.
3. Saisissez son adresse — ou choisissez-en une déjà enregistrée — et appuyez sur **Start**.
4. Accordez votre propre récepteur normalement. Le second **suit automatiquement** — fréquence, mode et bande passante — à chaque changement d'accord.

C'est toute la configuration. Rien à régler sur l'autre récepteur, et pas de commande d'accord séparée : il vous suit toujours.

### Adresses

| Second récepteur | Ce qu'il faut saisir | Remarques |
|---|---|---|
| PhantomSDR+ | `host:8900` | Le port normal du récepteur |
| KiwiSDR | `host:8073` | Le port propre au KiwiSDR |
| UberSDR | `host` | Son **port web normal**, pas le 8073 |
| WebSDR | `host:8901` | Le port propre du site. Nécessite le relais — voir plus bas |

Un simple nom d'hôte, une adresse `http://` ou une adresse `ws://` complète sont tous acceptés. Si l'autre récepteur est servi en HTTPS, saisissez le nom d'hôte et la connexion sera sécurisée.

### Récepteurs enregistrés

Chaque adresse utilisée est mémorisée, dans une liste propre à chaque type de récepteur — une adresse KiwiSDR n'est jamais une suggestion utile quand le sélecteur affiche WebSDR. Les listes restent dans votre propre navigateur : elles ne sont envoyées nulle part, et chaque auditeur a la sienne.

Le bouton **☰** à côté du champ d'adresse ouvre la liste.

- **Les noms.** Toute entrée peut recevoir un nom — `Twente` se lit mieux que `websdr.ewi.utwente.nl:8901`. Les entrées nommées apparaissent en vert au-dessus de leur adresse, et le nom s'affiche à côté de l'adresse dans la liste déroulante pendant la saisie. Une entrée est identifiée par son adresse : la nommer ne fait donc jamais figurer la même station deux fois. Tant que la diversité fonctionne, le récepteur auquel elle est reliée affiche son nom **en gras et clignotant lentement**, si bien que la liste indique aussi lequel vous entendez réellement.
- **add** saisit un récepteur à la main, sans s'y connecter d'abord. **✎** corrige le nom et l'adresse sur place, **✕** retire une entrée, et **clear all** vide la liste du type affiché. Entrée valide, Échap annule.
- **🌍** ouvre la page web propre à ce récepteur dans un nouvel onglet. Ce qui est enregistré, c'est l'adresse que le logiciel appelle : elle est donc d'abord retransformée en adresse consultable — `ws://` devient `http://`, et le chemin `/audio`, `/ws` ou, pour un KiwiSDR, `/kiwi/…/SND` dont chaque type de récepteur a besoin est retiré, puisque la page du site se trouve à la racine. C'est un vrai lien : clic du milieu et appui long se comportent comme d'habitude.
- **L'ordre est le vôtre.** Déplacez une ligne avec **▲▼**, ou faites-la glisser à la place qui lui revient. C'est dans cet ordre que la liste déroulante propose les adresses.
- **⭳ export et ⭱ import.** Les listes sont conservées dans le stockage du navigateur, effacé en même temps que les données du site — c'est précisément ce contre quoi ceci protège. Export écrit les quatre listes, noms compris, dans un fichier JSON que vous pouvez garder ou emporter vers un autre navigateur ou une autre machine. Import le relit et demande s'il faut le **fusionner** (merge) avec l'enregistré ou tout **remplacer** (replace).
- **▦ QR.** Dessine toutes les listes en code QR à l'écran, pour les emporter sur un téléphone — voir « Sur un téléphone » plus bas. Une liste trop grande pour être scannée se rabat sur le texte à côté, qui se copie et se colle n'importe où.

Le nombre de récepteurs conservés n'est pas limité.

### Sur un téléphone

La page `/mobile` offre la même fonction dans un onglet **Div**, à côté d'Audio, Bands, Marks, Users et Chat : type de récepteur, adresse, Start et Stop, les récepteurs enregistrés en liste à toucher, les valeurs en direct et la correction de SNR. Chaque ligne porte aussi le lien **🌍** vers la page propre du récepteur. Le second récepteur suit l'accord du téléphone tout seul, exactement comme sur la page de bureau. Ce qui manque, c'est l'édition — renommer, réordonner, supprimer — qui reste sur la page de bureau, où la place ne manque pas.

La liste enregistrée appartient à un navigateur : un téléphone commence donc avec une liste vide, quel que soit le nombre de récepteurs enregistrés sur l'ordinateur. C'est à cela que sert le code QR : sur l'ordinateur appuyez sur **☰** puis **▦ QR**, scannez le code avec l'appareil photo du téléphone et collez le texte dans **Import** de l'onglet Div. Il demande de fusionner ou de remplacer, et Export sur le téléphone envoie une liste dans l'autre sens.

---

## Utiliser un WebSDR

Un WebSDR — le logiciel écrit par Pieter-Tjerk de Boer, PA3FWM, qui fonctionne à Twente et sur plusieurs centaines d'autres sites — peut servir de second récepteur, mais pas directement depuis le navigateur.

La raison est un contrôle délibéré de leur côté. Un WebSDR refuse la connexion audio si l'en-tête `Origin` ne nomme pas son propre site, et `Origin` est un *nom d'en-tête interdit* : le navigateur le fixe d'après la page où vous êtes et aucun script n'a le droit de le modifier. Il n'existe aucun contournement côté client, et il ne devrait pas en exister.

La connexion est donc établie par un petit programme sur votre propre serveur, `websdr_relay.py`. Votre navigateur parle au relais, et le relais parle au WebSDR.

### Installer le relais

Les quatre installateurs de distribution le proposent en étape facultative. Pour une installation déjà en place :

```
cd ~/PhantomSDR-Plus
./setup_websdr_relay.sh
```

Il demande un port, reprend votre indicatif et l'adresse de votre station depuis `frontend/site_information.json`, et propose d'installer un service systemd pour que le relais démarre au boot. Les réglages sont dans `websdr_relay.json` et se modifient à tout moment.

**Une chose que l'installateur ne peut pas faire à votre place : ouvrir le port du relais sur votre routeur.** Les navigateurs des auditeurs se connectent directement au relais — il ne passe pas par le récepteur — sans cette redirection, la diversité avec un WebSDR ne fonctionne donc que depuis votre propre réseau. Les trois autres types de récepteur ne sont pas concernés.

Si le panneau d'administration est installé, son tableau de bord affiche une carte **WebSDR Diversity Relay** avec l'état, le port, le nombre de sessions en cours et vers quels sites.

### Être un invité correct

Le relais se connecte aux récepteurs des autres depuis votre serveur et non depuis l'adresse de chaque auditeur ; il est donc conçu pour bien se tenir :

- **Une limite de dix sessions simultanées vers un même WebSDR**, et soixante au total. C'est ce qui évite qu'une journée chargée chez vous ressemble à une attaque chez quelqu'un d'autre.
- **Un `User-Agent` nommant votre station et son opérateur**, pour qu'un opérateur qui préfère ne pas être utilisé ainsi sache exactement à qui écrire. Remplissez-le honnêtement.
- **Seules les commandes d'accord sont transmises.** La connexion ne peut servir à envoyer autre chose.
- **Les adresses privées, de loopback et de NAT opérateur sont refusées**, afin qu'aucun visiteur ne puisse pointer le relais vers quelque chose dans votre machine ou votre réseau local.

> [!IMPORTANT]
> Le contrôle d'`Origin` existe parce que les auteurs de WebSDR ne voulaient pas que leurs récepteurs soient pilotés depuis les pages d'autrui. Utiliser le relais est une décision réfléchie, pas un oubli de leur part. Laissez la limite où elle est, gardez le User-Agent honnête, et arrêtez si un opérateur vous le demande.

### Ce qui change avec un WebSDR

- **Beaucoup de sites ne couvrent que quelques tranches étroites du spectre**, et non une plage continue — par exemple une fenêtre de 256 kHz sur 40 m. La diversité ne s'engage qu'à l'intérieur, et le panneau lit la liste des bandes du site pour savoir où elles se trouvent.
- **La fréquence d'échantillonnage audio varie** avec la largeur du filtre et s'écarte davantage du nominal que chez les autres types : l'alignement peut donc être un peu plus long.
- **La CW n'est pas adaptée** à la convention de WebSDR, qui place la bande passante entièrement sous la porteuse. La BLU et l'AM sont correctes.

---

## Lire le panneau

En fonctionnement, le panneau affiche un petit tableau :

| Ligne | Signification |
|---|---|
| **link** | La connexion au second récepteur. `ready` est l'objectif. En cas d'échec, le texte d'erreur du serveur distant et le code de fermeture WebSocket s'affichent |
| **aligned** | Le décalage mesuré entre les deux flux une fois verrouillés, sinon `searching` |
| **corr** | La force de corrélation des deux flux. Significatif seulement après l'alignement |
| **remote audio** | Audio décodé en provenance du second récepteur. `none` en ambre signifie que rien n'est décodé |
| **SNR local / remote** | Les deux estimations de rapport signal/bruit comparées |
| **switches** | Le nombre de changements de site |

À côté du titre, un mot vous dit où vous en êtes :

| | |
|---|---|
| `off` (gris) | à l'arrêt |
| **`Please wait…`** (ambre) | en cours de connexion, ou connecté et encore en alignement |
| **`Ready`** (vert) | relié, verrouillé et suivant le meilleur site |
| l'erreur du récepteur distant (rouge) | échec, et cela ne se rétablira pas tout seul |

La distinction entre ambre et rouge est celle qui fait gagner du temps : ambre veut dire continuez d'attendre, rouge veut dire cessez d'attendre et lisez le message.

Le point coloré ajoute quel site vous entendez réellement — vert votre propre récepteur, cyan le distant.

### L'alignement demande environ 15 secondes

C'est normal. Les deux flux sont alignés en corrélant leurs **enveloppes audio**, ce qui exige une fenêtre de son. La recherche se fait en deux temps : une recherche étroite de ±1,5 seconde peut démarrer dès qu'environ 9 secondes de son ont été réunies, et une seconde mesure indépendante, cinq secondes plus tard, doit **concorder** avec la première avant que l'alignement soit accepté. Lorsque les deux stations sont plus éloignées que cela dans le temps — une ou deux secondes de tampon supplémentaire quelque part sur le trajet —, la recherche complète de ±4 secondes prend le relais vers 14 secondes et la confirmation suit à 19.

Cette étape de confirmation compte. Lorsque deux sites s'évanouissent en opposition — sans jamais porter le signal en même temps —, une corrélation unique se verrouille volontiers sur un décalage parfaitement faux mais assuré, qui s'entend comme un écho. Exiger deux mesures indépendantes concordantes l'écarte.

Une seconde chose doit être juste avant qu'un verrouillage tienne : les cadences d'échantillonnage des deux récepteurs. Deux récepteurs, ce sont deux horloges et deux chaînes de décimation : leurs flux audio n'arrivent **pas** tout à fait à la même cadence, même lorsque tous deux annoncent 12 kHz — 2% d'écart est normal, soit 240 échantillons de dérive par seconde, bien au-delà de la tolérance d'alignement. Le flux distant est donc rééchantillonné en continu à la cadence de votre propre récepteur. Ce rapport est obtenu en **comptant les échantillons**, non par corrélation : il n'a donc pas besoin de son propre verrouillage et il est établi dès les premières secondes — avant même la première recherche d'alignement. Un signal faible ou intermittent peut demander deux ou trois tentatives ; 30 secondes ne sont donc pas inquiétantes, une minute sans rien l'est.

Pendant `searching`, les deux valeurs de SNR affichent `0.0`. C'est voulu : les deux estimations sont mesurées sur des échantillons **alignés en contenu**, donc rien n'est mesuré avant qu'il y ait alignement. `0.0 / 0.0` veut dire « pas encore verrouillé », pas « pas de signal ».

---

## Remote SNR trim

Ce curseur pondère le choix entre les deux sites. Il est ajouté au SNR mesuré du récepteur distant avant la comparaison — positif favorise le distant, négatif le vôtre. Il ne change **rien d'autre** : ni le niveau audio, ni la combinaison, seulement le site retenu.

Il existe parce que les deux valeurs de SNR ne sont pas toujours comparables. Toutes deux sont mesurées de la même façon — comme un écart entre centiles de l'audio — mais un récepteur dont le codec relève son propre plancher de bruit affiche moins qu'il ne le mérite. Un KiwiSDR applique un fort gain et un limiteur, ce qui comprime l'écart ; un codec avec pertes fixe un plancher de bruit sous lequel le signal ne descend jamais.

**Comment le régler :**

1. Accordez les deux récepteurs sur un signal présent de façon fiable et attendez `aligned`.
2. Observez les deux valeurs de SNR pendant une demi-minute. Notez l'écart habituel.
3. Utilisez les extrémités comme test d'écoute : **+15** impose le site distant, **−15** le vôtre. Écoutez chacun quelques secondes. C'est le seul moyen d'entendre un site isolément.
4. Si le distant affiche par exemple 5 dB de moins mais sonne aussi bien, réglez **+5**. Vous faites concorder les deux lectures quand les deux sites sonnent pareil.
5. Surveillez le compteur **switches** sur dix minutes d'écoute. Des bascules incessantes signifient que le réglage est trop proche de l'égalité ; ne jamais basculer alors que votre récepteur s'évanouit audiblement signifie qu'il est trop décalé dans l'autre sens.

Points de départ : **0** pour un autre PhantomSDR-Plus, qui emploie une chaîne audio identique et est comparable par construction ; une petite valeur **positive** pour un KiwiSDR ou un UberSDR.

> [!TIP]
> S'il vous faut plus de ±8 dB environ, arrêtez de corriger. À ce stade, l'explication honnête est en général qu'un récepteur est réellement moins bon pour ce trajet, et pondérer au-delà d'une différence réelle revient simplement à écouter le site le plus faible.

Le réglage s'applique immédiatement et est mémorisé dans votre navigateur.

---

## Choisir un second récepteur

**La distance compte.** Les évanouissements se décorrèlent avec la distance — quelques centaines de kilomètres en HF constituent un bon objectif. Deux récepteurs dans la même ville s'évanouissent ensemble et n'apportent rien. Trop éloignés, et le second récepteur risque de ne pas entendre votre signal du tout.

**Les deux doivent réellement entendre le signal.** Aucune logiciel ne contourne cette exigence. Si le second récepteur n'entend pas ce que vous écoutez, la corrélation reste faible et il ne se verrouillera pas — volontairement, car un alignement erroné sonne plus mal que pas de diversité du tout.

**Couverture.** Un second PhantomSDR-Plus ou un KiwiSDR annonce la plage de fréquences qu'il couvre, et le panneau vous avertit si vous vous accordez en dehors. Un WebSDR annonce ses bandes, souvent des tranches étroites plutôt qu'une plage continue. UberSDR n'annonce pas sa couverture : là, le refus de se verrouiller est votre seul indice.

> [!IMPORTANT]
> Les récepteurs publics sont tenus par des bénévoles et disposent d'un nombre limité de places d'écoute. Une session de diversité en occupe une tant qu'elle dure, exactement comme un auditeur humain. Soyez prévenant avant d'en laisser une connectée indéfiniment, et demandez à l'opérateur si vous comptez utiliser son récepteur intensivement.

---

## Dépannage

**`link` ne quitte jamais `connecting`, ou enchaîne connexion/fermeture** L'adresse ou le port sont probablement erronés. Voyez le tableau ci-dessus — en particulier, UberSDR utilise son port web normal, pas le 8073. Le panneau affiche le code de fermeture WebSocket, et la console du navigateur (F12) l'erreur sous-jacente.

**`link` affiche une erreur suivie d'un texte** Ce texte vient de l'autre récepteur et il est généralement précis : session refusée, serveur plein, ou récepteur qui n'accepte pas les clients extérieurs.

**Le KiwiSDR refuse la connexion** Certains KiwiSDR exigent un mot de passe, et sur un UberSDR le point d'accès compatible KiwiSDR est désactivé par défaut. Pour un UberSDR, utilisez le type **UberSDR** — cette voie est toujours disponible.

**WebSDR : `the WebSDR relay is not reachable`** Le relais ne tourne pas, ou votre navigateur n'atteint pas son port. Il doit être joignable sur le **même nom d'hôte que celui qui sert la page du récepteur**, car le navigateur s'y connecte directement et non à travers le récepteur. Ouvrez `http://<ce nom d'hôte>:<port du relais>/status` dans le même navigateur pour savoir lequel des deux. S'il répond sur votre réseau local mais pas depuis l'extérieur, le port n'est pas redirigé sur le routeur.

**WebSDR : une erreur mentionnant une connexion refusée** Ce site est verrouillé plus strictement que le contrôle d'`Origin` habituel, ou son opérateur a bloqué cette station.

**`link` est `ready` mais `remote audio` indique `none`** Aucun audio n'est décodé. Rechargez la page ; si cela persiste, la console du navigateur indiquera quel décodeur a échoué.

**L'audio arrive mais ne s'aligne jamais** Les deux récepteurs n'entendent pas la même chose. Essayez une station de radiodiffusion puissante, ou une bande où les deux sites bénéficient d'une bonne propagation. Une bande calme avec seulement du bruit des deux côtés ne corrélera jamais — et c'est très bien ainsi.

**Cela bascule sans arrêt** Les deux sites sont trop proches en SNR. Décalez légèrement le trim pour qu'un site soit préféré de façon stable.

**Le second récepteur n'est jamais utilisé** Vérifiez que `remote audio` augmente et que les valeurs de SNR paraissent cohérentes. Si le distant affiche bien moins qu'il ne sonne, c'est précisément à cela que sert le trim.

---

## Limites

- **Ce n'est pas cohérent.** Pas de phasing, pas de nulling, pas de radiogoniométrie. Annuler une source de bruit exige deux antennes sur une même horloge et un même site ; c'est une autre technique pour un autre problème.
- **Une à trois secondes de retard**, inévitablement.
- **Deux récepteurs seulement.**
- **Mono.** Si votre récepteur est dans un mode stéréo comme le C-QUAM, l'audio passe sans modification et la diversité ne s'engage pas.
- **L'alignement exige du signal.** En dessous d'environ 10 dB de SNR sur l'un des deux sites, attendez-vous à rester sur `searching`.
- **Un WebSDR exige le relais** sur votre propre serveur, et son port redirigé. Les trois autres types de récepteur n'ont besoin ni de l'un ni de l'autre.
