# PhantomSDR-Plus — Pilotage du transceiver (CAT)

Gardez **votre propre transceiver** et un **récepteur PhantomSDR-Plus** sur la même fréquence, le même mode et le même filtre. Tournez le bouton d'accord du poste et la cascade suit ; cliquez sur un signal dans la cascade et le poste s'y accorde. Passez en émission, et le récepteur peut se taire pour ne pas vous renvoyer votre propre signal.

Cela fonctionne avec les récepteurs **PhantomSDR-Plus, KiwiSDR, PA3FWM WebSDR et UberSDR**, le vôtre ou celui d'un autre, et ne déplace jamais que *votre* session d'écoute — personne d'autre sur le récepteur n'entend ni ne voit rien. L'opérateur du récepteur n'a rien à installer ni à configurer.

---

## Ce qu'il vous faut

Deux façons de raccorder un poste, et une condition côté récepteur :

| Élément | Ce que c'est | Synchronise |
|---|---|---|
| **[Desktop PhantomSDR+](https://www.dropbox.com/scl/fo/kjwj96zg3kj7dgq4fjef9/APnA3c9hhv4hk3YMGIGjH7s?rlkey=jfiwklly63kv73poalx631pk3&st=m37uvaym&dl=0) 4.0 ou ultérieur** | L'application de bureau, avec un menu **Rig**. Linux (PC et Raspberry Pi) et Windows. | Fréquence, mode, largeur de filtre, coupure du son en émission — dans un sens ou dans les deux |
| **[CATsync Tool for WebSDRs](https://catsyncsdr.wordpress.com/)** | Un programme Windows séparé qui couple un poste à la page du récepteur dans votre navigateur. | Fréquence et mode |
| **TCI-CAT sur la page du récepteur** | Un bouton sur la page PhantomSDR-Plus elle-même, dans n'importe quel navigateur. Parle TCI avec ExpertSDR, AetherSDR ou Thetis, ou avec tout poste pris en charge par Hamlib grâce à un petit pont. Uniquement sur les récepteurs PhantomSDR-Plus en version 4.1.0 ou ultérieure. | Fréquence, mode et largeur de filtre dans les deux sens ; coupure du son en émission |
| **Le récepteur** | PhantomSDR-Plus, KiwiSDR, PA3FWM WebSDR ou UberSDR. Un récepteur PhantomSDR-Plus demande la **4.1.0** ou ultérieure pour la largeur de filtre et la coupure du son. | Un PhantomSDR-Plus plus ancien synchronise toujours fréquence et mode |

L'essentiel de ce manuel décrit Desktop PhantomSDR+. Le bouton TCI-CAT a sa propre section, [TCI-CAT sur la page du récepteur](#tci-cat-sur-la-page-du-récepteur). Le CATsync Tool a sa propre documentation sur son site.

---

## Récepteurs pris en charge

L'application reconnaît le type de récepteur d'une fenêtre de station et le pilote par les commandes propres à cette page. La fenêtre Rig control indique le type trouvé à côté du nom de la station.

| Récepteur | Fréquence et mode | Largeur de filtre | Coupure du son en émission |
|---|---|---|---|
| PhantomSDR-Plus | Oui | Avec la 4.1.0 ou ultérieure | Avec la 4.1.0 ou ultérieure |
| KiwiSDR (y compris Web-888) | Oui | Oui | Oui |
| PA3FWM WebSDR | Oui, avec changement de bande sur un site multibande | Oui | Oui |
| UberSDR | Oui | Oui | Oui |

Un récepteur web a moins de modes que la plupart des postes, si bien que certains modes du poste partagent un mode du récepteur : KiwiSDR et WebSDR n'ont qu'un seul CW pour CW et CW-R. Les modes de récepteur cités dans ce manuel sont ceux de PhantomSDR-Plus ; les autres récepteurs utilisent l'équivalent le plus proche. Un WebSDR garde un filtre CW sous 1 kHz et les autres filtres à 1 kHz ou plus, parce que c'est ainsi que la page elle-même reconnaît le CW, et une fréquence hors de toutes les bandes d'un site WebSDR est laissée de côté. UberSDR règle son filtre par pas de curseur, de sorte qu'une largeur peut tomber jusqu'à environ 50 Hz de celle du poste. Tout autre type de page — OpenWebRX, par exemple — affiche *not a receiver this app can drive*, et rien n'est synchronisé.

---

## Ce qu'il fait, et ce qu'il ne fait pas

- Il synchronise **un poste avec une fenêtre de récepteur** à la fois.
- Il lit les deux côtés plusieurs fois par seconde et, s'ils diffèrent, règle l'un sur l'autre. Il **n'émet pas**, ne commande pas le PTT et n'envoie de son nulle part.
- Déplacer le récepteur ne change que votre propre session. Les autres auditeurs du même récepteur ne sont pas affectés, et l'opérateur n'a pas à l'autoriser.
- Un port série ne peut être ouvert que par **un programme à la fois**. Si WSJT-X, un carnet de trafic ou un utilitaire du constructeur tient déjà le port, utilisez le choix **flrig** ou **rigctld on network** pour partager le poste au lieu de vous disputer le port.

---

## Démarrage rapide

1. Ouvrez une station dans Desktop PhantomSDR+ comme d'habitude.
2. **Rig → Rig control...**
3. Sous **Connection**, choisissez **Built-in** si votre poste est dans la liste, sinon **Hamlib (all rigs)**.
4. Choisissez votre poste, le port série et la vitesse réglée dans le menu CAT ou CI-V du poste.
5. Sous **Sync**, laissez **Both directions** sélectionné.
6. Appuyez sur **Connect**. Les deux affichages du haut — transceiver et récepteur — doivent montrer la même fréquence en moins d'une seconde.

Chaque réglage est enregistré dès que vous le modifiez. La fois suivante, **Rig → Connect** suffit, ou cochez **Connect when the app starts**.

---

## Choisir comment joindre le poste

| Choix | À utiliser quand | Il faut |
|---|---|---|
| **Built-in** | Votre poste figure dans la liste ci-dessous. | Rien d'autre |
| **Hamlib (all rigs)** | Votre poste est autre chose — Hamlib en connaît plus de 300. L'application lance pour vous le `rigctld` de Hamlib, sur un port local privé, et l'arrête à la déconnexion. | Windows : rien, Hamlib est inclus. Linux : `sudo apt install libhamlib-utils` |
| **rigctld on network** | Un `rigctld` tourne déjà, sur cet ordinateur ou un autre de votre réseau. | L'hôte et le port (4532 par défaut) |
| **flrig** | flrig pilote déjà le poste pour fldigi, WSJT-X ou un carnet de trafic. | flrig lancé, avec son port XML-RPC (12345 par défaut) |

### Postes avec pilote intégré

La vitesse et l'adresse CI-V indiquées sont les valeurs d'usine que l'application préremplit. **Ce n'est qu'un point de départ — réglez-les selon le menu de votre poste.**

| Famille | Postes | Vitesse par défaut | Remarques |
|---|---|---|---|
| **Icom CI-V** | IC-7300, IC-7610, IC-705, IC-9700, IC-905, IC-7760, IC-7851, IC-7100, IC-7410, IC-9100, IC-7600, IC-7200, IC-7700, IC-7000, IC-7800, IC-756PROIII, IC-756PROII, IC-R8600 et tout autre poste CI-V | 19200 | Adresse CI-V préremplie par modèle (IC-7300 `94`, IC-705 `A4`, IC-9700 `A2`, IC-7610 `98` …) |
| | IC-746PRO, IC-718, IC-R75 | 9600 | |
| **Xiegu** (CI-V) | G90, X6100 | 19200 | Adresse `70` ; vérifiez le menu |
| **Yaesu nouveau CAT** | FTDX101D/MP, FTDX10, FT-710, FT-991/A, FT-891, FTDX5000, FTDX3000, FTDX1200, FT-950, FT-2000, FT-450/450D | 38400 | |
| **Yaesu CAT classique** | FT-817/818, FT-857/857D, FT-897/897D | 38400 | 2 bits de stop ; s'accorde par pas de 10 Hz |
| **Kenwood** | TS-990S, TS-890S, TS-590S/SG | 115200 | |
| | TS-480, TS-2000, TS-870S | 57600 | |
| **Elecraft** | K4, K3/K3S, KX3, KX2 | 38400 | La largeur de filtre est synchronisée |
| **Compatibles Kenwood** | FlexRadio SmartSDR CAT (port virtuel), QRP Labs QMX/QMX+/QDX, (tr)uSDX, Lab599 Discovery TX-500, autres postes compatibles Kenwood | 9600–38400 | |

Un poste censé être compatible mais qui ne dialogue pas avec un pilote intégré fonctionne généralement avec **Hamlib**, qui s'accommode de bien plus de variantes.

---

## Réglages du port série

| Réglage | Quoi y mettre |
|---|---|
| **Serial port** | Le port du poste. Les adaptateurs USB et les postes à port USB sont listés en premier. **Other / network address...** accepte un port absent de la liste — `COM7`, `/dev/ttyUSB1` — ou `tcp://hôte:port` pour un port série servi sur le réseau par ser2net ou équivalent. |
| **Speed (baud)** | Exactement ce qu'indique le menu de débit CAT / CI-V du poste. Un débit erroné ressemble à un poste qui ne répond jamais. |
| **Stop bits** | 1 pour presque tout ; 2 pour la famille FT-817/857/897. |
| **CI-V address** | Icom uniquement, en hexadécimal (`94`, pas `148`). Doit correspondre au menu d'adresse CI-V. |
| **DTR / RTS** | Laissez-les **désactivés** sauf si votre interface en a besoin. Beaucoup de câbles CAT déclenchent l'émetteur, ou réinitialisent le poste, sur l'une de ces lignes. |
| **Hardware flow control** | Désactivé, sauf si le manuel demande RTS/CTS. |

Avec **Hamlib**, les mêmes réglages sont transmis à `rigctld`. Les bits de stop y ont en plus un choix *Rig default*, et **Extra rigctld options** accepte toute autre option de `rigctld`, par exemple `--set-conf=post_write_delay=10`. **rigctld program** permet de désigner un `rigctld` précis si plusieurs sont installés.

---

## Synchronisation

### Sens

| Choix | Ce qui se passe |
|---|---|
| **Rig → receiver** | La fenêtre du récepteur suit le poste. Une modification dans la cascade est ramenée à la fréquence du poste. |
| **Receiver → rig** | Le poste suit la fenêtre du récepteur. Tourner le bouton du poste est annulé. |
| **Both directions** | Le côté touché **en dernier** l'emporte. Au moment de la connexion, avant qu'aucun ne soit touché, c'est le poste. |

Le sens se change aussi depuis le menu **Rig** en cours de connexion.

### Comment on empêche les deux côtés de se battre

Chaque valeur écrite par l'application réapparaît un instant plus tard comme un changement de l'autre côté. Pris au pied de la lettre, le poste et le récepteur se courraient après sans fin. L'application l'évite de trois façons :

- La page du récepteur applique un changement immédiatement ; elle est donc relue juste après l'écriture, et cette lecture devient le nouveau point de départ.
- Un poste applique un changement un peu plus tard ; chaque valeur envoyée est donc mémorisée. Quand le poste renvoie cette valeur, elle est reconnue comme une écriture de l'application et non comme une main sur le bouton.
- Une valeur que le poste refuse — la FM large sur un poste HF, par exemple — est envoyée **deux fois** puis laissée tranquille jusqu'à ce que le côté source change, au lieu d'être répétée plusieurs fois par seconde.

Réaccorder la page du récepteur peut lui faire choisir le mode par défaut de la bande (LSB sous 10 MHz, par exemple). Quand c'est le poste qui mène, l'application remet aussitôt le mode du poste, si bien qu'un poste en USB sur 40 m garde le récepteur en USB.

### Quelle fenêtre de récepteur

**Receiver window** choisit quelle station suit le poste :

- **The station window last in front** (par défaut) — avec deux stations ouvertes, cliquez dans l'une et le poste la suit.
- **Une station précise** — le poste y reste attaché, qu'elle soit au premier plan ou non. Si cette station n'est pas ouverte, rien n'est synchronisé jusqu'à son ouverture.

### Cadence de mise à jour

**Update every** fixe la fréquence de lecture des deux côtés : 150 ms, 300 ms (par défaut), 500 ms ou 1 s. Plus rapide paraît plus immédiat au bouton ; plus lent ménage un vieux poste à 4800 ou 9600 bauds, où chaque lecture prend un vrai temps sur la ligne.

---

## Modes

| Mode du poste | Le récepteur écoute en |
|---|---|
| USB, LSB | USB, LSB |
| CW | CW |
| CW-R (inversé) | CW-L |
| AM, AM synchrone, DSB | AM |
| FM, FM étroite | FM |
| FM large | WBFM |
| RTTY / FSK | LSB |
| RTTY-R / FSK-R | USB |
| Modes données (USB-D, DATA-U, PKTUSB, DIG) | USB |
| Données LSB, données FM | LSB, FM |

| Mode du récepteur | Le poste est mis en |
|---|---|
| USB, LSB | USB, LSB |
| CW | CW |
| CW-L | CW-R |
| AM, QUAM | AM |
| FM | FM |
| WBFM | WFM — la plupart des postes HF le refusent et sont laissés tranquilles après deux essais |
| RADE (supérieur / inférieur) | USB / LSB |

Un poste en **mode données** y reste : l'USB du récepteur est considéré comme d'accord avec l'USB-D du poste, si bien que le récepteur ne fait jamais sortir le poste du mode données.

---

## Largeur de filtre

Cochez **Sync filter width** pour aligner les bandes passantes. Des écarts de moins de 60 Hz sont tenus pour égaux, puisque deux filtres n'ont jamais les mêmes pas.

| Liaison avec le poste | Largeur de filtre |
|---|---|
| Hamlib | Oui, là où Hamlib la prend en charge pour ce poste |
| flrig | Oui |
| Icom CI-V intégré | Oui — pas de 50 Hz jusqu'à 500 Hz, puis de 100 Hz jusqu'à 3,6 kHz ; AM par pas de 200 Hz jusqu'à 10 kHz ; pas en FM |
| Elecraft intégré | Oui, par pas de 10 Hz |
| Kenwood, Yaesu, famille FT-817 intégrés | Non — ces postes choisissent leurs filtres dans des tables propres à chaque modèle. Utilisez Hamlib si vous avez besoin du filtre |

Les récepteurs KiwiSDR, WebSDR et UberSDR ont toujours la commande. Un récepteur PhantomSDR-Plus doit avoir la **4.1.0** ou ultérieure ; sur un plus ancien, la fréquence et le mode se synchronisent toujours, et la fenêtre Rig control explique pourquoi le filtre ne suit pas.

---

## Coupure du son en émission

Cochez **Mute receiver while transmitting**. Tant que le poste est en émission, la fenêtre du récepteur est muette, et le son revient au retour en réception. Le bouton muet du récepteur l'indique, et vous pouvez toujours rétablir le son à la main.

Si vous aviez déjà coupé le son vous-même, il reste coupé ensuite.

Il faut une liaison qui signale l'état d'émission — tous les pilotes intégrés, flrig, et Hamlib pour la plupart des postes — et, sur un récepteur PhantomSDR-Plus, la 4.1.0 ou ultérieure.

---

## Décalage de fréquence

**Frequency offset** est ajouté à la fréquence du poste pour obtenir celle du récepteur :

> fréquence du récepteur = fréquence du poste + décalage

| Installation | Décalage |
|---|---|
| Transverter 2 m sur un poste 10 m (144,100 MHz s'affiche 28,100 MHz) | `116000000` |
| Transverter 70 cm sur un poste 2 m (432 → 144) | `288000000` |
| Pas de transverter | `0` |

---

## Le menu Rig

| Élément | Rôle |
|---|---|
| **Rig control...** | Ouvre la fenêtre Rig control |
| **Connect / Disconnect** *nom du poste* | Démarre ou arrête la synchronisation ; avec Hamlib, démarre ou arrête aussi `rigctld` |
| **Rig to receiver / Receiver to rig / Both directions** | Sens de synchronisation |
| **Sync filter width** | Oui / non |
| **Mute receiver while transmitting** | Oui / non |
| Ligne d'état | *Not connected*, *Connecting...*, *Connected: nom*, ou la dernière erreur |

L'affichage de fréquence en direct se trouve dans la fenêtre Rig control et non dans le menu, qui sinon se refermerait à chaque changement.

---

## Linux

**Droits sur le port série.** Les ports série appartiennent au groupe `dialout`. Un utilisateur qui n'en fait pas partie obtient *Could not open ttyUSB0*. Ajoutez-vous une fois, puis déconnectez-vous et reconnectez-vous :

```bash
sudo usermod -aG dialout $USER
```

**Hamlib.** Installez-le depuis votre distribution :

```bash
sudo apt install libhamlib-utils
```

Le paquet `.deb` de Desktop PhantomSDR+ le recommande, donc `sudo apt install ./phantomsdr-plus-desktop_4.0.0_amd64.deb` l'installe avec ; `dpkg -i` n'installe pas les paquets recommandés. Les pilotes intégrés et flrig n'ont pas besoin de Hamlib.

## Windows

Le `rigctld.exe` de Hamlib lui-même est inclus dans l'installateur 64 bits comme dans le 32 bits. Les ports COM apparaissent dans la liste sous leur nom (`COM3`). Si le poste demande un pilote USB, installez d'abord celui du constructeur — le port n'existe pas avant.

---

## TCI-CAT sur la page du récepteur

Une page de récepteur PhantomSDR-Plus peut aussi suivre un transceiver **toute seule**, sans l'application de bureau : le navigateur dialogue directement avec un serveur **TCI** sur votre propre ordinateur. TCI est le protocole de pilotage par WebSocket d'ExpertSDR2/ExpertSDR3 (SunSDR), d'AetherSDR (FlexRadio) et de Thetis (Apache Labs ANAN, Hermes). Pour un poste sans TCI, un petit pont fourni avec PhantomSDR-Plus fait passer n'importe quel poste Hamlib pour un serveur TCI.

Il faut un récepteur PhantomSDR-Plus en version **4.1.0 ou ultérieure**. Les pages KiwiSDR, WebSDR et UberSDR ne l'ont pas.

### Le bouton TCI-CAT

Le bouton se trouve dans la rangée **VFO**, **Modes**, **Bands** et **IF Filters** — **TCI-CAT** dans la mise en page large, **CAT** dans la compacte. Son point est **vert** tant qu'un serveur TCI est connecté, **gris** sinon. Il ouvre une fenêtre avec : Jusqu'à la 4.2.0, le bouton s'appelait **QRG Sync**.

| Commande | Rôle |
|---|---|
| État | *Active — TCI (port 50001)* une fois connecté ; *Inactive* avec ⏳ *Wait* pendant la recherche |
| **CAT Sync** | Active ou désactive la synchronisation de la fréquence, du mode et du filtre. La coupure du son en émission fonctionne dans les deux cas |
| **Host** | L'ordinateur qui fait tourner le serveur TCI : `localhost` pour cet ordinateur, sinon son adresse sur le réseau local, par ex. `192.168.1.42`. Appuyez sur Entrée ou cliquez ailleurs pour reconnecter |

Rien d'autre à choisir : les ports **50001** (ExpertSDR3, AetherSDR) et **40001** (ExpertSDR2, Thetis) sont essayés en même temps et réessayés toutes les quelques secondes, si bien que la page se connecte dès que le logiciel démarre. **CAT Sync** et **Host** sont mémorisés par le navigateur.

Les navigateurs qui demandent l'autorisation avant qu'une page web n'accède au réseau local — les versions récentes de Chrome et d'Edge le font — posent la question une fois, lors de la première connexion. Acceptez, sinon le point reste gris.

### Ce qui est synchronisé

| | Comportement |
|---|---|
| **Poste → récepteur : fréquence** | Seul le cadran bouge. Zoom, luminosité et contraste restent comme vous les avez laissés ; la cascade ne défile que si la fréquence sort de l'écran, et le plan de bandes ne change pas le mode |
| **Poste → récepteur : mode** | Suit quand le mode du poste change — USB, LSB, CW, AM, FM ; les modes numériques en USB ou LSB. Un mode que le récepteur n'a pas le laisse inchangé. Un décodeur en cours garde son propre mode |
| **Poste → récepteur : largeur de filtre** | La bande passante du récepteur prend la largeur de filtre du poste : changer le filtre du poste, ou appuyer sur sa touche **FIL**, change la bande passante. Un décodeur en cours garde sa propre bande passante |
| **Récepteur → poste : fréquence** | Taper une fréquence, une étiquette ou un signet, un clic dans la cascade et le glissement de la bande passante déplacent le VFO du poste. Un glissement n'envoie que les fréquences qui changent |
| **Récepteur → poste : mode** | Chaque changement de mode sur la page — une touche de mode, le plan de bandes, un décodeur, un signet — règle le mode du poste (USB, LSB, CW, AM, FM ; RADE en USB ou LSB). Un poste en mode numérique (USB-D) y reste |
| **Récepteur → poste : largeur de filtre** | Les boutons **IF Filters**, le curseur IF, le glissement de la bande passante et un changement de mode règlent le filtre du poste ; un glissement n'envoie que la largeur finale. Sur les postes Icom, le pont sélectionne à la place FIL1, FIL2 ou FIL3 — voir [Filtres Icom](#filtres-icom-fil1-fil2-fil3) |
| **Pas d'écho** | Un changement venu du poste ne lui est jamais renvoyé, et un rapport du mode ou du filtre précédent du poste qui arrive juste après un changement sur la page est ignoré |
| **Coupure du son en émission** | Toujours active, même avec CAT Sync désactivé : la page se tait pendant que le poste émet. Déplacer le curseur de volume pendant l'émission la laisse muette ; en réception, le son revient au niveau actuel du curseur |
| **Non géré** | Split, VFO B, RIT/XIT et décalages de transverter. Seul le VFO A du premier récepteur est suivi |

Le mode et la largeur de filtre passent par les commandes propres au TCI (`modulation`, `rx_filter_band`), donc ExpertSDR, AetherSDR et Thetis devraient les suivre aussi ; seul le pont Hamlib a été essayé. Pour un décalage de transverter, utilisez plutôt Desktop PhantomSDR+. N'utilisez pas les deux en même temps sur le même poste — deux contrôleurs se disputeraient le cadran.

### Avec quels transceivers cela fonctionne

| Transceiver | Fonctionne | Comment |
|---|---|---|
| SunSDR (ExpertSDR2/3), FlexRadio (AetherSDR), ANAN/Hermes (Thetis) | Oui | Directement — activez le serveur TCI dans le logiciel. Pas encore essayé avec ces logiciels ; testé avec un serveur TCI simulé |
| Un poste doté d'un port CAT pris en charge par Hamlib — la plupart des Icom, Yaesu, Kenwood, Elecraft, Xiegu, QRP Labs | Oui | Via le pont Hamlib ci-dessous. Essayé avec un **Icom IC-7300** sous Linux et Windows ; d'autres pilotes peuvent différer sur les noms de modes ou le signalement du PTT |
| Un poste sans port CAT, ou non pris en charge par Hamlib | Non | Il n'y a rien où lire la fréquence |

### Le pont Hamlib (IC-7300 et autres postes sans TCI)

`tci-bridge/tci-rigctld.mjs`, dans l'arborescence PhantomSDR-Plus, fait de tout poste que Hamlib sait piloter un serveur TCI pour la page. Il tourne sur **votre** ordinateur — celui qui est relié au poste, à côté du navigateur — pas sur le récepteur. Quatre fois par seconde il interroge Hamlib sur la fréquence, le mode, la largeur de filtre et l'état d'émission, n'envoie à la page que ce qui a changé et transmet au poste les changements de fréquence, de mode et de filtre de la page.

Il atteint Hamlib par l'une de deux voies :

| Voie | Chaîne | Quand |
|---|---|---|
| **`--rigctl`** (recommandée) | transceiver → `rigctl` → `tci-rigctld.mjs` → page | Normalement. Le pont lance lui-même le `rigctl` de Hamlib : une fenêtre, aucun port réseau. **À utiliser sous Windows**, où `rigctld.exe` est souvent refusé avec *Access is denied* |
| **`rigctld`** | transceiver → `rigctld` → `tci-rigctld.mjs` → page | Un autre programme, comme WSJT-X, doit utiliser le poste en même temps — voir [Partager le poste](#partager-le-poste--la-voie-rigctld) |

**Ce qu'il lui faut**

| | Linux | Windows |
|---|---|---|
| Hamlib | `sudo apt install libhamlib-utils`, ou le paquet hamlib de votre distribution | `hamlib-w64-….zip` depuis [github.com/Hamlib/Hamlib/releases](https://github.com/Hamlib/Hamlib/releases), extrait dans `C:\hamlib` — `rigctl.exe` se trouve dans `C:\hamlib\bin` |
| Node.js | 18 ou plus récent | Le *Windows Installer (.msi)* LTS de [nodejs.org](https://nodejs.org), avec les options par défaut |
| Le paquet `ws` | Trouvé automatiquement dans l'arborescence PhantomSDR-Plus | Copiez `tci-rigctld.mjs` dans un dossier comme `C:\tci-bridge` et lancez-y une fois `npm install ws` |
| Le port du poste | `ls /dev/serial/by-id/`. Rejoignez une fois le groupe `dialout` : `sudo usermod -aG dialout $USER`, puis déconnexion et reconnexion | Installez le pilote USB du fabricant ; le numéro COM figure dans **Gestionnaire de périphériques → Ports (COM et LPT)** |

Un seul programme peut tenir le port CAT du poste. Fermez WSJT-X, flrig, JS8Call, RS-BA1 ou la connexion au poste de Desktop PhantomSDR+ avant de lancer le pont.

#### Exemple : Icom IC-7300

Sur le poste : **MENU → SET → Connectors → CI-V** — **CI-V USB Baud Rate** `115200`, **CI-V Transceive** `ON`. Le numéro de modèle Hamlib de l'IC-7300 est `3073`.

**Linux.** Le poste est la ligne contenant `IC-7300` dans `ls /dev/serial/by-id/`, en général aussi `/dev/ttyUSB0`.

1. Vérifiez que Hamlib atteint le poste — il doit afficher la fréquence, par ex. `14280000` :
   ```bash
   rigctl -m 3073 -r /dev/ttyUSB0 -s 115200 f
   ```
2. Lancez le pont et laissez-le tourner :
   ```bash
   cd ~/PhantomSDR-Plus/tci-bridge
   node tci-rigctld.mjs --rigctl rigctl -m 3073 -r /dev/ttyUSB0 -s 115200
   ```

**Windows.** Le poste apparaît dans le Gestionnaire de périphériques comme *Silicon Labs CP210x USB to UART Bridge (COM4)* — utilisez votre propre numéro COM. Dans une invite de commandes :

1. Vérifiez que Hamlib atteint le poste — il doit afficher la fréquence :
   ```bat
   C:\hamlib\bin\rigctl.exe -m 3073 -r COM4 -s 115200 f
   ```
2. Lancez le pont et laissez la fenêtre ouverte :
   ```bat
   cd C:\tci-bridge
   node tci-rigctld.mjs --rigctl C:\hamlib\bin\rigctl.exe -m 3073 -r COM4 -s 115200
   ```
   La ligne est longue : vérifiez qu'elle se termine bien par `-s 115200`, sinon `rigctl` s'arrête avec *Type: rigctl --help*.

Sur les deux systèmes le pont affiche, en une seconde :

```
rig answered through rigctl
rig -> page 14280000 Hz
rig -> page mode USB
rig -> page RX
```

Ouvrez ensuite la page du récepteur dans un navigateur sur le même ordinateur, ouvrez **TCI-CAT** et activez **CAT Sync**. Le point passe au vert et le pont affiche `page connected`. Tournez le VFO et le récepteur suit ; cliquez dans la cascade et le poste suit (`page -> rig ... Hz`) ; passez en émission et la page se tait. **Ctrl+C** arrête le pont, et `rigctl` avec lui.

Tout ce qui suit `--rigctl` est le programme `rigctl` et ses propres options — exactement celles qui ont fonctionné lors de la vérification. C'est la règle pour tout poste : **quand `rigctl … f` affiche la fréquence, le pont fonctionne avec les mêmes options.**

#### Filtres Icom (FIL1, FIL2, FIL3)

Les postes Icom comme l'IC-7300 n'acceptent pas n'importe quelle largeur de filtre : ils ont trois filtres, **FIL1**, **FIL2** et **FIL3**, chacun avec une largeur réglée dans le menu du poste. Avec une largeur, Hamlib sélectionnerait l'un d'eux et écraserait aussi sa largeur — et sur l'IC-7300 cette largeur peut atterrir sur le filtre sélectionné auparavant, ce qui mélange les réglages. C'est pourquoi, sur les postes Icom, le pont n'envoie jamais de largeur : il prend le filtre dont la largeur de référence est la plus proche de la bande passante de la page et se contente de le **sélectionner**, avec la commande CI-V du poste lui-même. Les largeurs réglées sur le poste ne changent jamais.

| Mode | FIL1 | FIL2 | FIL3 |
|---|---|---|---|
| USB, LSB (et leurs modes numériques) | 2700 Hz | 2400 Hz | 1800 Hz |
| CW | 1200 Hz | 500 Hz | 250 Hz |
| AM | 9000 Hz | 6000 Hz | 3000 Hz |
| FM | 15000 Hz | 10000 Hz | 7000 Hz |

Sur l'IC-7300 (`-m 3073`) c'est automatique. Réglez les filtres SSB du poste en conséquence — FIL1 2,7 kHz, FIL2 2,4 kHz, FIL3 1,8 kHz (maintenez **FIL** enfoncé sur le poste) — et choisir 2,7 / 2,4 / 1,8 kHz dans **IF Filters** sélectionne FIL1 / FIL2 / FIL3, tandis qu'appuyer sur **FIL** sur le poste met la bande passante de la page à la largeur de ce filtre. Le pont affiche par exemple `page -> rig filter 2398 Hz  LSB  → FIL2  sent`.

| Option | Usage |
|---|---|
| `--filters 3000,2400,1800` | D'autres largeurs de référence SSB, dans l'ordre FIL1,FIL2,FIL3 ; active aussi la sélection de filtre pour un autre poste Icom |
| `--civ A4` | L'adresse CI-V du poste en hexadécimal, quand ce n'est pas `94` (IC-705 `A4`, IC-9700 `A2`, IC-7610 `98`) |
| `--filters off` | Envoyer les largeurs par Hamlib, comme pour les autres marques |

Les deux options se placent avant `--rigctl`, par ex. `node tci-rigctld.mjs --filters 3000,2400,1800 --civ A4 --rigctl rigctl -m 3085 -r /dev/ttyACM0 -s 19200`. Essayé uniquement avec un IC-7300. Les autres marques — Yaesu, Kenwood, Elecraft et les autres — reçoivent la largeur de la page par Hamlib, qui la règle d'aussi près que le poste le permet.

#### Autres postes

Les mêmes étapes valent pour tout poste pris en charge par Hamlib ; seules les options changent.

1. **Préparez le poste.** Dans son menu, notez la vitesse CAT (ou CI-V) et activez un réglage comme *CAT par USB* ou *CI-V transceive* s'il en a un. Sous Windows, installez le pilote USB du fabricant.
2. **Trouvez le numéro de modèle Hamlib** dans la liste affichée par `rigctl -l` :
   - Linux : `rigctl -l | grep -i 991`
   - Windows : `C:\hamlib\bin\rigctl.exe -l | findstr /i 991`
3. **Trouvez le port.** Linux : `ls /dev/serial/by-id/`. Windows : Gestionnaire de périphériques. Certains postes créent **deux** ports — les FT-991A, FTDX10 et FT-710 de Yaesu les nomment *Enhanced* et *Standard* ; le CAT est sur le port **Enhanced**.
4. **Vérifiez, puis lancez le pont** avec `-m <modèle> -r <port> -s <vitesse>`, comme dans l'exemple de l'IC-7300 : d'abord `rigctl -m … -r … -s … f`, puis les mêmes options après `--rigctl`.

Quelques numéros de modèle, d'après Hamlib 4.5 — confirmez-les avec `rigctl -l`, car une autre version de Hamlib peut numéroter un poste différemment :

| Poste | `-m` | Poste | `-m` |
|---|---|---|---|
| Icom IC-7300 | 3073 | Yaesu FT-991 / FT-991A | 1035 |
| Icom IC-705 | 3085 | Yaesu FTDX10 | 1042 |
| Icom IC-7610 | 3078 | Yaesu FT-710 | 1049 |
| Icom IC-9700 | 3081 | Yaesu FT-891 | 1036 |
| Xiegu G90 | 3088 | Yaesu FT-817 | 1020 |
| Xiegu X6100 | 3087 | Kenwood TS-590SG | 2037 |
| Elecraft K3 / K3S | 2029 | Kenwood TS-890S | 2041 |
| Elecraft KX3 | 2045 | Kenwood TS-2000 | 2014 |
| Elecraft K4 | 2047 | QRP Labs QCX / QDX | 2052 |

Options supplémentaires, seulement si nécessaire :

- **Un poste Icom dont l'adresse CI-V a été changée :** ajoutez `-c` et l'adresse en *décimal* — `94h` donne `-c 148`.
- **Un réglage que Hamlib propose pour ce poste :** `rigctl -m <modèle> -L` les liste ; fixez-en un avec `-C nom=valeur`, par ex. `-C post_write_delay=10` pour une interface lente.
- **Un poste qui passe en émission ou redémarre à l'ouverture du port :** certains câbles CAT utilisent DTR ou RTS pour le PTT ; ajoutez `-C dtr_state=OFF -C rts_state=OFF`.

#### Exemple : Yaesu FT-991A

Non essayé avec un vrai FT-991A — il suit les réglages de Hamlib pour ce poste ; la vérification `rigctl … f` indique aussitôt si cela fonctionne.

Sur le poste, réglez **CAT RATE** (menu 031) sur `38400`. Le numéro de modèle Hamlib des FT-991 et FT-991A est `1035`.

Le câble USB du FT-991A crée **deux** ports série. Le CAT est sur le port **Enhanced** :

- **Linux :** `ls /dev/serial/by-id/` affiche deux lignes pour le poste ; celle qui se termine par `-if00-port0` est l'Enhanced, en général `/dev/ttyUSB0`.
- **Windows :** le Gestionnaire de périphériques affiche *Silicon Labs Dual CP2105 USB to UART Bridge: Enhanced COM Port (COM5)* et un *Standard COM Port* ; utilisez le numéro de l'Enhanced.

**Linux :**
```bash
rigctl -m 1035 -r /dev/ttyUSB0 -s 38400 f
cd ~/PhantomSDR-Plus/tci-bridge
node tci-rigctld.mjs --rigctl rigctl -m 1035 -r /dev/ttyUSB0 -s 38400
```

**Windows :**
```bat
C:\hamlib\bin\rigctl.exe -m 1035 -r COM5 -s 38400 f
cd C:\tci-bridge
node tci-rigctld.mjs --rigctl C:\hamlib\bin\rigctl.exe -m 1035 -r COM5 -s 38400
```

Si la vérification n'affiche rien d'utile, la cause habituelle est le port Standard au lieu de l'Enhanced, ou un CAT RATE différent de `-s`.

#### Exemple : Kenwood TS-590SG

Non essayé avec un vrai TS-590SG — il suit les réglages de Hamlib pour ce poste ; la vérification `rigctl … f` indique aussitôt si cela fonctionne.

Dans le menu du poste, réglez la vitesse du port **USB** sur `115200` (le numéro de menu figure dans le manuel du TS-590SG). Le numéro de modèle Hamlib est `2037` ; l'ancien TS-590S est `2031`. Sous Windows, installez d'abord le pilote de port COM virtuel de Kenwood pour le port USB.

Le câble USB crée **un** port série :

- **Linux :** la ligne du poste dans `ls /dev/serial/by-id/`, en général `/dev/ttyUSB0`.
- **Windows :** Gestionnaire de périphériques → Ports (COM et LPT), par exemple `COM6`.

**Linux :**
```bash
rigctl -m 2037 -r /dev/ttyUSB0 -s 115200 f
cd ~/PhantomSDR-Plus/tci-bridge
node tci-rigctld.mjs --rigctl rigctl -m 2037 -r /dev/ttyUSB0 -s 115200
```

**Windows :**
```bat
C:\hamlib\bin\rigctl.exe -m 2037 -r COM6 -s 115200 f
cd C:\tci-bridge
node tci-rigctld.mjs --rigctl C:\hamlib\bin\rigctl.exe -m 2037 -r COM6 -s 115200
```

Si la vérification échoue, la cause habituelle est une vitesse USB différente de `-s`, ou un câble branché sur la prise RS-232 (COM) du poste alors que `-r` désigne le port USB.

#### Autres exemples

Aucun n'a été essayé sur du matériel réel. Chaque ligne donne les options à placer après `rigctl` pour la vérification et après `--rigctl rigctl` pour le pont ; réglez la même vitesse dans le menu du poste. Le port Linux est le port habituel — confirmez-le avec `ls /dev/serial/by-id/`. Sous Windows, remplacez le port par le numéro COM du Gestionnaire de périphériques et `rigctl` par `C:\hamlib\bin\rigctl.exe`.

| Poste | Menu du poste | Options (Linux) | Remarques |
|---|---|---|---|
| Icom IC-705 (USB) | CI-V USB Baud Rate `19200` | `-m 3085 -r /dev/ttyACM0 -s 19200` | Deux ports apparaissent ; le CI-V est le premier (`ttyACM0`) |
| Icom IC-7100 (USB) | CI-V USB Baud Rate `19200` | `-m 3070 -r /dev/ttyUSB0 -s 19200` | La vitesse maximale de Hamlib pour ce poste est 19200 |
| Icom IC-7610 | CI-V USB Baud Rate `115200` | `-m 3078 -r /dev/ttyUSB0 -s 115200` | |
| Icom IC-9700 | CI-V USB Baud Rate `38400` | `-m 3081 -r /dev/ttyUSB0 -s 38400` | |
| Yaesu FTDX101D / FTDX101MP | CAT RATE `38400` | `-m 1040 -r /dev/ttyUSB0 -s 38400` | `-m 1044` pour le FTDX101MP. Deux ports ; utilisez l'Enhanced |
| Yaesu FTDX10 | CAT RATE `38400` | `-m 1042 -r /dev/ttyUSB0 -s 38400` | Deux ports ; utilisez l'Enhanced, comme sur le FT-991A |
| Yaesu FT-710 | CAT RATE `38400` | `-m 1049 -r /dev/ttyUSB0 -s 38400` | Deux ports ; utilisez l'Enhanced, comme sur le FT-991A |
| Yaesu FT-891 | CAT RATE `38400` | `-m 1036 -r /dev/ttyUSB0 -s 38400` | Deux ports ; utilisez l'Enhanced, comme sur le FT-991A |
| Yaesu FT-450D | CAT RATE `38400` | `-m 1046 -r /dev/ttyUSB0 -s 38400` | Prise RS-232 : utilisez un adaptateur USB-série |
| Yaesu FT-817 / FT-818 | CAT RATE `38400` | `-m 1020 -r /dev/ttyUSB0 -s 38400` | `-m 1041` pour le FT-818. Demande un câble CAT sur la prise ACC |
| Yaesu FT-857 / FT-897 | CAT RATE `38400` | `-m 1022 -r /dev/ttyUSB0 -s 38400` | `-m 1023` pour le FT-897. Demande un câble CAT |
| Kenwood TS-890S (USB) | Vitesse USB `115200` | `-m 2041 -r /dev/ttyUSB0 -s 115200` | |
| Kenwood TS-990S (USB) | Vitesse USB `115200` | `-m 2039 -r /dev/ttyUSB0 -s 115200` | |
| Kenwood TS-590SG / TS-590S (USB) | Vitesse USB `115200` | `-m 2037 -r /dev/ttyUSB0 -s 115200` | Exemple détaillé ci-dessus |
| Kenwood TS-480 | Vitesse du port COM `57600` | `-m 2028 -r /dev/ttyUSB0 -s 57600` | Prise RS-232 : utilisez un adaptateur USB-série |
| Kenwood TS-2000 | Vitesse du port COM `57600` | `-m 2014 -r /dev/ttyUSB0 -s 57600` | Prise RS-232 ; la vitesse maximale de Hamlib pour ce poste est 57600 |
| Elecraft K4 (USB) | Vitesse RS232 `115200` | `-m 2047 -r /dev/ttyUSB0 -s 115200` | |
| Elecraft K3 / K3S | Vitesse RS232 `38400` | `-m 2029 -r /dev/ttyUSB0 -s 38400` | K3S : USB ; K3 : port série ou câble KUSB |
| Elecraft KX3 | Vitesse RS232 `38400` | `-m 2045 -r /dev/ttyUSB0 -s 38400` | Câble KXUSB |
| Elecraft KX2 | Vitesse RS232 `38400` | `-m 2044 -r /dev/ttyUSB0 -s 38400` | Câble KXUSB |
| Xiegu G90 | Vitesse CI-V `19200` | `-m 3088 -r /dev/ttyUSB0 -s 19200` | Hamlib utilise l'adresse CI-V par défaut du G90 |
| Xiegu X6100 | Vitesse CI-V `19200` | `-m 3087 -r /dev/ttyUSB0 -s 19200` | La vitesse maximale de Hamlib pour ce poste est 19200 |
| Lab599 TX-500 | — | `-m 2050 -r /dev/ttyUSB0 -s 9600` | Hamlib utilise uniquement 9600 |
| ELAD FDM-DUO | — | `-m 33001 -r /dev/ttyUSB0 -s 115200` | |
| QRP Labs QDX | — | `-m 2052 -r /dev/ttyACM0 -s 9600` | Un port série USB ; la vitesse ne compte pas mais doit être indiquée |

Commande Linux complète pour l'IC-705, pour montrer comment lire une ligne :

```bash
rigctl -m 3085 -r /dev/ttyACM0 -s 19200 f
node tci-rigctld.mjs --rigctl rigctl -m 3085 -r /dev/ttyACM0 -s 19200
```

#### Postes pilotés par un autre logiciel

Certains postes sont déjà pilotés par un logiciel capable de faire le travail — parfois sans aucun pont. Aucune de ces voies n'a été essayée.

| Poste et logiciel | Que faire |
|---|---|
| **SunSDR** avec ExpertSDR2/3, **FlexRadio** avec AetherSDR, **Apache Labs ANAN / Hermes** avec Thetis | Pas de pont. Activez le **serveur TCI** du logiciel et utilisez **TCI-CAT** directement — les ports 50001 et 40001 sont trouvés automatiquement |
| **FlexRadio** avec SmartSDR (Windows) | Ajoutez un port dans **SmartSDR CAT**. Il parle le CAT Kenwood, donc un port série y fonctionne comme un TS-2000 : `-m 2014 -r COM8 -s 57600`. Un port TCP fonctionne avec le modèle FlexRadio de Hamlib : `-m 2036 -r 127.0.0.1:<port>` |
| **Tout poste piloté par flrig** | Laissez flrig tourner et utilisez le modèle flrig de Hamlib ; le poste reste partagé avec fldigi, WSJT-X et les logiciels de trafic : `-m 4 -r 127.0.0.1:12345` |
| **Un rigctld en cours d'exécution**, ou un logiciel offrant un serveur *Hamlib NET rigctl* | Lancez le pont sans `--rigctl`, avec cette adresse : `node tci-rigctld.mjs 50001 127.0.0.1:4532` |

Comme partout, les options se placent après `rigctl` pour la vérification et après `--rigctl rigctl` pour le pont. Une adresse réseau comme `127.0.0.1:12345` n'a pas besoin de `-s`.

#### Partager le poste : la voie rigctld

Quand WSJT-X ou un logiciel de trafic doit utiliser le poste pendant que le pont tourne, lancez le serveur de Hamlib `rigctld` avec les mêmes options, laissez-le tourner et reliez les deux programmes à lui :

```bash
rigctld -m 3073 -r /dev/ttyUSB0 -s 115200
node tci-rigctld.mjs
```

Sans `--rigctl`, le pont cherche `rigctld` sur `127.0.0.1:4532` et affiche `rigctld connected` ; `node tci-rigctld.mjs 50001 192.168.1.50:4532` utilise un `rigctld` sur un autre ordinateur. Dans WSJT-X, choisissez le poste *Hamlib NET rigctl* à la même adresse. Sous Windows le serveur est `C:\hamlib\bin\rigctld.exe` avec les mêmes options ; si Windows répond *Access is denied*, utilisez `--rigctl` et fermez l'autre programme pendant que le pont tourne.

**Ports.** Le pont sert le TCI sur le port 50001 ; un autre port se place en premier sur la ligne de commande, par ex. `node tci-rigctld.mjs 40001 --rigctl …`. Si le pont et le navigateur sont sur des ordinateurs différents, indiquez dans **Host** l'adresse de l'ordinateur du pont.

### Dépannage de TCI-CAT

| Symptôme | Cause probable | Que faire |
|---|---|---|
| Le point reste gris | Serveur TCI ou pont arrêté ; **Host** erroné ; l'autorisation réseau local du navigateur a été refusée | Activez TCI dans ExpertSDR/Thetis/AetherSDR ou lancez le pont ; vérifiez **Host** ; autorisez l'accès au réseau local dans les paramètres du site |
| `rigctl … f` renvoie une erreur ou reste en attente | Mauvais port ou mauvaise vitesse ; pas de droit `dialout` (Linux) ou pas de pilote USB (Windows) ; un autre programme tient le port | Alignez `-s` sur le menu du poste ; vérifiez le port (`ls /dev/serial/by-id/`, Gestionnaire de périphériques) ; fermez les autres programmes de pilotage |
| Le pont affiche *rigctl stopped … Type: rigctl --help* | La commande est incomplète — en général la vitesse après `-s` manque | Retapez la ligne entière |
| Le pont affiche *The value after -s is missing* | La ligne de commande a été coupée au collage | Retapez la fin de la ligne, par ex. `-s 115200` |
| Le filtre ne suit pas dans un sens ou dans l'autre | **CAT Sync** est désactivé, un décodeur tourne sur la page, ou (IC-7300) les largeurs FIL du poste diffèrent de 2700 / 2400 / 1800 Hz | Activez CAT Sync ; arrêtez le décodeur ; réglez les largeurs FIL sur le poste, ou indiquez `--filters` avec les largeurs du poste |
| Le pont affiche *rigctl stopped … rig_open: error* | `rigctl` ne peut pas ouvrir le port | Comme pour `rigctl … f` ci-dessus |
| Le pont affiche *the rig is not answering* | Le port s'ouvre mais le poste ne répond pas : mauvaise vitesse ou mauvais modèle, CAT désactivé dans le menu, ou adresse CI-V Icom changée | Refaites la vérification `rigctl … f` ; ajoutez `-c` si l'adresse CI-V a été changée |
| Le pont affiche *rigctld not reachable* | Lancé sans `--rigctl`, et aucun `rigctld` ne tourne | Ajoutez `--rigctl …`, ou lancez d'abord `rigctld` |
| `rigctld.exe` répond *Access is denied* (Windows) | Windows refuse de l'exécuter | Utilisez `--rigctl` — il ne demande que `rigctl.exe` |
| Connecté, mais le récepteur ne bouge pas | **CAT Sync** est désactivé | Activez-le — la coupure en émission fonctionne sans lui |
| Le mode du poste ne suit pas | Mode sans équivalent sur le récepteur, ou pilote Hamlib qui renvoie un nom inhabituel | La fréquence reste synchronisée ; réglez le mode sur la page |
| Pas de coupure en émission | Le poste ou son pilote Hamlib ne signale pas l'état d'émission | Rien à régler sur la page |
| Le cadran fait des allers-retours | Desktop PhantomSDR+ ou un autre programme synchronise aussi le poste | Un seul contrôleur à la fois |

---

## Pour les opérateurs de récepteurs

Rien à configurer. Le pilotage du transceiver passe par une petite interface JavaScript que chaque page PhantomSDR-Plus possède déjà ; il ne demande ni réglage serveur, ni port ouvert, ni droit d'administration. Les fonctions de filtre et de coupure du son sont arrivées avec la version 4.1.0 — après l'avoir appliquée, recompilez le frontend (`./recompile.sh`, option 2) ; inutile d'arrêter le récepteur. Les récepteurs KiwiSDR, WebSDR et UberSDR n'ont besoin de rien non plus : l'application utilise les commandes que leurs pages possèdent déjà.

Le bouton **TCI-CAT** est arrivé lui aussi avec la 4.1.0, là encore une simple recompilation du frontend. Il n'ouvre aucun port sur le récepteur : la connexion va du navigateur de chaque auditeur vers son propre ordinateur. Le pont Hamlib, `tci-bridge/tci-rigctld.mjs`, est destiné aux auditeurs, chez eux ; le récepteur ne l'utilise pas.

---

## Pour les développeurs : l'interface de la page

Desktop PhantomSDR+ comme le CATsync Tool utilisent ces fonctions, que chaque page PhantomSDR-Plus place sur `window` une fois chargée (les pages KiwiSDR, WebSDR et UberSDR sont pilotées par leurs propres commandes, différentes) :

| Fonction | Renvoie / fait |
|---|---|
| `catsync_ready` | `true` dès que les fonctions ci-dessous sont installées |
| `catsync_getFrequency()` | Fréquence d'accord, Hz |
| `catsync_setFrequency(hz)` | S'accorde sur `hz` |
| `catsync_getMode()` | `USB`, `LSB`, `CW`, `CW-L`, `AM`, `QUAM`, `FM`, `WBFM`, `RADEU`, `RADEL` |
| `catsync_setMode(mode)` | Règle le mode ; ramène la bande passante à la valeur par défaut du mode |
| `catsync_getBandwidth()` | Largeur totale de la bande passante, Hz |
| `catsync_setBandwidth(hz)` | Règle la largeur — s'élargit vers le haut en USB, vers le bas en LSB, également des deux côtés sinon. À appeler **après** `catsync_setMode` |
| `catsync_getMute()` | `true` si le son est coupé |
| `catsync_setMute(on)` | Coupe ou rétablit le son, via le bouton muet de la page |

Les quatre dernières sont arrivées avec la 4.1.0 ; testez donc avant de les appeler :

```js
if (window.catsync_ready) {
  window.catsync_setFrequency(7074000)
  window.catsync_setMode('USB')
  if (typeof window.catsync_setBandwidth === 'function') window.catsync_setBandwidth(2400)
}
```

Régler la fréquence réaccorde l'audio : n'appelez un setter que lorsque la valeur a réellement changé — un setter appelé en boucle avec la même valeur s'entend. Les anciens points d'entrée de style KiwiSDR/WebSDR (`setfreq`, `set_mode`, `freqset_complete`) restent disponibles pour les outils qui les attendent.

---

## Dépannage

| Symptôme | Cause probable | Que faire |
|---|---|---|
| *Could not open ttyUSB0* (Linux) | Pas dans le groupe `dialout`, ou un autre programme tient le port | `sudo usermod -aG dialout $USER`, se déconnecter et se reconnecter ; fermer WSJT-X, carnets de trafic, utilitaires du poste |
| L'affichage du récepteur indique *not a receiver this app can drive* | Un autre type de récepteur web, ou la page est encore en chargement | Sont pris en charge PhantomSDR-Plus, KiwiSDR, PA3FWM WebSDR et UberSDR ; laisser quelques secondes à une page lente |
| *The rig did not answer* | Mauvaise vitesse, mauvais type de poste, mauvaise adresse CI-V, poste éteint | Aligner la vitesse sur le menu du poste ; vérifier l'adresse CI-V ; essayer Hamlib |
| *Hamlib is not installed* | Aucun `rigctld` trouvé | Linux : `sudo apt install libhamlib-utils`. Ou indiquer son chemin dans **rigctld program** |
| *rigctld stopped: ...* | Hamlib n'a pas pu ouvrir le poste — son propre message suit | Généralement le port ou la vitesse ; le texte après les deux-points est la raison donnée par Hamlib |
| *flrig is not running at ...* | flrig fermé, ou son port XML-RPC diffère | Lancer flrig ; vérifier le port dans sa configuration |
| Connecté, mais le récepteur ne bouge pas | Aucune fenêtre de station ouverte, ou **Receiver window** attaché à une station fermée | Ouvrir la station, ou choisir *The station window last in front* |
| Le poste passe en émission à la connexion | DTR ou RTS déclenche le poste via votre interface | Décocher **DTR on** et **RTS on** |
| Le filtre ne suit pas | Récepteur antérieur à la 4.1.0, ou pilote intégré Kenwood/Yaesu | Fréquence et mode se synchronisent toujours ; utiliser Hamlib pour le filtre sur Kenwood/Yaesu |
| La coupure en émission ne fait rien | Récepteur sans la mise à jour, ou le poste ne signale pas l'état d'émission | Comme ci-dessus |
| *Lost the rig ... reconnecting* | Câble débranché, poste éteint ou rigctld arrêté | Rien — nouvel essai toutes les 3 secondes, puis reprise dès le retour du poste |
| Les deux côtés sautent sans arrêt | Deux programmes pilotent le poste en même temps | Ne laisser qu'un programme régler le poste, ou le partager via flrig |

---

## Limites connues

- Un poste, une fenêtre de récepteur à la fois.
- Les récepteurs autres que PhantomSDR-Plus, KiwiSDR, PA3FWM WebSDR et UberSDR — OpenWebRX, par exemple — ne sont pas pris en charge.
- Les pilotes intégrés suivent les protocoles publiés par les constructeurs et ont été testés contre des postes simulés et un vrai Hamlib ; pour un poste qui se comporte autrement, Hamlib est la solution de repli.
- Le split, le VFO B, le RIT/XIT et les canaux mémoire ne sont pas synchronisés — seulement la fréquence du VFO actif.
- TCI-CAT sur la page du récepteur ne synchronise ni le split, ni le VFO B, ni le RIT/XIT, ni les décalages de transverter, et n'a été essayé qu'avec un IC-7300 via le pont Hamlib.
- Sous Linux, les paquets utilisent le Hamlib de la distribution ; aucun n'est embarqué.
