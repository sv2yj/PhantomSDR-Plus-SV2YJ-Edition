# Guide de l'utilisateur PhantomSDR-Plus

Bienvenue dans PhantomSDR-Plus ! Ce guide vous aidera à tirer le meilleur parti de votre écoute WebSDR.

---

## Table des matières

1. [Introduction](#introduction)
2. [Premiers pas](#premiers-pas)
3. [Vue d'ensemble de l'interface](#vue-densemble-de-linterface)
4. [Opérations de base](#opérations-de-base)
5. [Fonctions avancées](#fonctions-avancées)
6. [Modes de démodulation](#modes-de-démodulation)
7. [Décodeurs numériques](#décodeurs-numériques)
8. [Raccourcis clavier](#raccourcis-clavier)
9. [Favoris](#favoris)
10. [Utilisation sur mobile](#utilisation-sur-mobile)
11. [Conseils et bonnes pratiques](#conseils-et-bonnes-pratiques)
12. [Dépannage](#dépannage)
13. [Foire aux questions](#foire-aux-questions)

---

## Introduction

### Qu'est-ce que PhantomSDR-Plus ?

PhantomSDR-Plus est une radio logicielle (SDR) accessible par le web qui vous permet d'écouter des signaux radio via Internet. Aucun logiciel ni matériel particulier n'est requis de votre côté — il suffit d'un navigateur web moderne !

### Que pouvez-vous écouter ?

Selon la configuration du WebSDR, vous pouvez vous accorder sur :

- **Radioamateurs** : opérateurs radioamateurs du monde entier
- **Stations de radiodiffusion** : radio AM/FM, radiodiffusion en ondes courtes
- **Aviation** : contrôle aérien, communications aéronautiques
- **Maritime** : liaisons navire-côte, météo maritime
- **Satellites météo** : NOAA, METEOR-M
- **Modes numériques** : FT8, RTTY, PSK31 et davantage
- **Stations utilitaires** : signaux horaires, militaires, gouvernementaux

### Configuration requise

- **Navigateur** : Chrome/Edge (recommandé), Firefox, Safari
- **Connexion** : Internet haut débit (1 Mbit/s ou plus recommandé)
- **Audio** : haut-parleurs ou écouteurs fonctionnels
- **Facultatif** : souris à molette pour un accord plus facile

---

## Premiers pas

### 1. Accéder au WebSDR

Ouvrez votre navigateur et rendez-vous à l'adresse du WebSDR fournie par l'opérateur.

Exemple : `http://websdr.example.com:9002`

### 2. Chargement initial de la page

Au chargement de la page, vous verrez :
- un affichage en cascade coloré montrant l'activité radio
- un panneau de commande avec l'affichage de fréquence et des boutons
- un S-mètre indiquant la force du signal
- un indicateur du nombre d'utilisateurs

### 3. Commencer à écouter

1. **Cliquez sur un signal** dans l'affichage en cascade
2. **L'audio démarre automatiquement**
3. **Réglez le volume** avec la commande de volume de votre navigateur ou le curseur à l'écran
4. **Affinez la fréquence** en cliquant précisément sur le signal

---

## Vue d'ensemble de l'interface

### Composants principaux

```
┌──────────────────────────────────────────────────────────────────────────┐
│  WebSDR <callsign>, located in <QTH>              ⚙ [ Analog S-Meter ▾ ] │
│  email · Keyboard Shortcuts · Users · Stats · Other servers 1 2 3        │
│  Frequency Search: MW SW HamDash PSK Reporter WSPRnet · Callsign Search  │
│                        [ Open Additional Info ]                          │
├──────────────────────────────────────────────────────────────────────────┤
│                     Spectrum  +  Waterfall                               │
│                     band-plan strip along the bottom                     │
├───────────────────────┬────────────────────────────┬─────────────────────┤
│ Audio & Buffer        │   Frequency  │  S-Meter    │ Waterfall Controls  │
│   volume · SQ · zoom  │   7,120.00   │  dBm dBμV   │   Min · Max · zoom  │
│ AGC Auto Fast Med Slow│   band · VFO │  SNR · NF   │   colour-map strip  │
│   Compressor Equalizer├────────────────────────────┤ Zoom In Out Max Min │
│ Filters               │  Fine Tuning (kHz)         │ Waterfall Spectrum  │
│   NR NB NS AN CTCSS   │  VFO A · Modes · Bands     │ Auto Adj. Height    │
│ Modes selector        │           · IF Filters     │ [ profile ▾ ]       │
│   ...  RADEL  RADEU   │  Wheel Tuning Steps        │ [ Bookmarks ]       │
│   USB LSB CW AM QUAM  │  Decoders                  │                     │
│   FM                  │   FT8 FT4 FT2 JS8 CW WSPR  │                     │
│ Band selector         │   FAX SSTV NAVTEX RTTY ... │                     │
└───────────────────────┴────────────────────────────┴─────────────────────┘
```

Les trois panneaux sous la cascade défilent comme une seule page ; dans une fenêtre étroite ils s'empilent au lieu de se placer côte à côte. **RADEL** et **RADEU** se trouvent sur la ligne de titre *Modes selector* elle-même, à sa droite.

### 1. Affichage en cascade

La cascade est une représentation visuelle des signaux radio :

- **Axe horizontal** : la fréquence
- **Axe vertical** : le temps (défile vers le bas)
- **Couleurs** : la force du signal
  - **Bleu foncé/noir** : aucun signal (plancher de bruit)
  - **Vert/jaune** : signaux faibles à moyens
  - **Orange/rouge** : signaux forts
  - **Blanc** : signaux très forts

### 2. Affichage de la fréquence

Indique la fréquence actuellement accordée dans divers formats :
- **MHz** : 7.100.000 MHz (bandes HF)
- **kHz** : 14200 kHz
- **Hz** : 145500000 Hz (VHF/UHF)

### 3. S-mètre (analogique ou numérique)

Affiche la force du signal :
- **S1-S9** : échelle standard de force de signal
- **+dB** : signaux au-dessus de S9 (p. ex. S9+20dB)
- **Analogique ou numérique** : selon la configuration

### 4. Boutons de mode

Sélectionnez le mode de démodulation :
- **AM** : modulation d'amplitude
- **FM** : modulation de fréquence
- **USB** : bande latérale supérieure
- **LSB** : bande latérale inférieure
- **CW** : code Morse (onde entretenue)
- **WBFM** : FM à large bande (radiodiffusion)
- **QUAM** : AM stéréo C-QUAM — le libellé passe au vert dès qu'un pilote stéréo est détecté

À côté du titre **Modes selector** se trouvent les boutons **RADEL** et **RADEU**, qui lancent la voix numérique RADE v1 en une seule pression — voir [Décodeurs numériques](#décodeurs-numériques).

### 5. Panneau de commande

Commandes supplémentaires :
- **AGC** : contrôle automatique de gain
- **NR** : réduction de bruit (spectrale)
- **NB** : silencieux d'impulsions
- **NS** : suppression du bruit de fond
- **AN** : notch automatique
- **CTCSS** : squelch à sous-tonalité (FM)
- **SQL** : squelch
- **AI** : réduction de bruit par IA (modes phonie)
- **Zoom** : niveau de zoom de la cascade
- **Wheel Tuning Steps** : pas d'accord de la molette de la souris
- **Decoders** : boutons qui démarrent et arrêtent chaque décodeur en une pression

### 6. Superposition du plan de bandes

Barres colorées indiquant les attributions de fréquences :
- des couleurs différentes pour différents services
- aide à identifier ce qui est autorisé sur chaque fréquence

---

## Opérations de base

### S'accorder sur une fréquence

#### Méthode 1 : cliquer sur la cascade

1. Cliquez directement sur un signal dans la cascade
2. Le récepteur s'accorde sur cette fréquence
3. L'audio démarre

#### Méthode 2 : saisir la fréquence

1. Cliquez sur l'affichage de la fréquence
2. Tapez la fréquence souhaitée
3. Appuyez sur Entrée

Exemples :
- `7100` → 7.100 MHz
- `14200.0` → 14.200 MHz
- `145.500` → 145.500 MHz

#### Méthode 3 : utiliser la molette de la souris

1. Placez le pointeur sur l'affichage de la fréquence
2. Molette vers le haut pour augmenter la fréquence
3. Molette vers le bas pour la diminuer

#### Méthode 4 : boutons de pas

1. Utilisez les boutons **▲** et **▼** à côté de la fréquence
2. Le pas varie selon le mode :
   - **AM/FM** : pas de 1 kHz
   - **BLU** : pas de 100 Hz
   - **CW** : pas de 10 Hz

### Scanner

Le scanner promène le récepteur sur une plage de canaux et s'arrête sur le premier qui porte un signal. Il se trouve sur la ligne **Fine Tuning (kHz)**, tout à droite :

```
7 152.0   ◀  ■  ▶  ⊘   30 dB · 4 ▾
```

| Commande | Rôle |
|----------|------|
| **◀ ▶** | Balayer vers le bas / le haut. À l'arrêt sur un signal, une flèche relance le balayage. |
| **■** | Arrêter. |
| **⊘** | Exclure ce canal du balayage — pour une porteuse permanente ou un birdie. |
| **30 dB · 4 ▾** | Le seuil, et à côté le niveau mesuré à l'instant. Ouvre les réglages. |

Le texte à gauche indique ce que fait le scanner : `Scanner` au repos, la fréquence atteinte pendant le balayage, `◉ 3s` pendant le décompte avant reprise, `◉ 30·22s` tant que le canal est encore occupé, `◉ hold` quand il reste en place.

**Réglages**

- **Range** — *Scan Band* balaie la bande où commence le balayage ;
  *Scan Visible* balaie exactement ce que montre la cascade et la suit si vous
zoomez ou la déplacez.
- **Scan** — *Every channel* accorde et écoute chaque canal à son tour ;
  *Skip empty* lit le spectre et saute directement aux signaux.
- **Stop at** — de combien un canal doit dépasser le bruit de fond de la bande
pour arrêter le balayage, en dB. Le bruit est suivi en continu : le même réglage convient de jour comme de nuit. Un canal vide n'affiche pas 0 dB — regardez un instant la valeur sur le bouton et placez le seuil au-dessus.
- **Resume after** — combien de temps un canal doit rester calme avant que le
balayage reparte. Les pauses de la parole ne le relancent pas. *Hold* reste en place jusqu'à ce que vous appuyiez sur un bouton.
- **Max stay** — repart au bout de ce temps même si le signal est toujours là,
pour qu'une porteuse permanente ne bloque pas le balayage indéfiniment.

Le pas suit le mode — 1 kHz en BLU, 0,1 kHz en CW, 5 kHz en AM, 9 ou 10 kHz en ondes moyennes et 9 kHz en grandes ondes — et les arrêts tombent sur la grille des canaux. Le balayage reste dans sa plage et dans ce que le récepteur peut accorder ; à une extrémité il reprend à l'autre.

Les réglages et les canaux exclus sont mémorisés dans votre navigateur.


### Choisir le mode de démodulation

Choisissez le mode adapté au signal :

**Pour les communications vocales :**
- **AM** : aviation, radiodiffusion AM, certains trafics amateurs
- **FM** : relais VHF/UHF, radiodiffusion FM
- **USB** : radioamateur HF (20 m, 17 m, 15 m, 12 m, 10 m)
- **LSB** : radioamateur HF (160 m, 80 m, 40 m, 30 m)

**Pour les données / le numérique :**
- **USB** : la plupart des modes numériques (FT8, PSK31, RTTY)
- **LSB** : certains modes numériques sur les bandes HF basses

**Pour le code Morse :**
- **CW** : signaux télégraphiques / Morse

### Régler le volume

- **Curseur à l'écran** : faites glisser le curseur de volume
- **Volume du navigateur** : utilisez les commandes multimédias du navigateur
- **Volume système** : ajustez le volume de votre ordinateur
- **Clavier** : utilisez les touches + et - (si prises en charge)

### Utiliser le S-mètre

Le S-mètre indique la force du signal :

- **S0-S3** : signal très faible, difficile à copier
- **S4-S6** : signal faible à moyen
- **S7-S9** : signal bon à fort
- **S9+** : signal extrêmement fort

**Astuce** : pour un meilleur son, accordez-vous sur des signaux affichant S7 ou plus.

**Changer le cadran de l'instrument** : sur le S-mètre analogique (à aiguille), cliquez sur l'instrument lui-même — ou sélectionnez-le et appuyez sur Entrée ou Espace — pour faire défiler trois fonds : métal brossé sombre, un cadran clair gris pâle et un cadran ambre chaud de style vintage. Votre navigateur retient le choix : il est toujours là après un rafraîchissement ou un redémarrage. Il vaut par navigateur et par adresse : ouvrir le récepteur par nom d'hôte et par IP donne deux réglages distincts, et une fenêtre privée repart toujours du réglage par défaut du site.

---

## Fonctions avancées

### Contrôle automatique de gain (AGC)

L'AGC ajuste automatiquement les niveaux audio :

- **Off** : aucun réglage automatique du gain
- **Slow** : variations de niveau progressives (idéal pour la BLU)
- **Medium** : réponse équilibrée
- **Fast** : ajustement rapide (idéal pour l'AM)

**Recommandation** : commencez par « Fast » pour l'AM, « Slow » pour la BLU.

### Les quatre commandes de bruit

NR, NB, NS et AN sont des boutons marche/arrêt distincts, chacun s'attaquant à un type de bruit différent. Ils sont indépendants — en activer un n'en active aucun autre — et se combinent librement.

Aucun n'atteint les décodeurs : FT8, CW, WSPR, SSTV, FAX, NAVTEX, RTTY/PSK31/Olivia et le grabber QRSS lisent l'audio *avant* ces filtres. Vous pouvez donc les régler purement à l'oreille sans influer sur ce qui est décodé. Voir le [manuel des décodeurs](DECODERS.md#12-conseils-généraux).

### Réduction de bruit (NR)

Réduction de bruit spectrale. Elle estime le niveau de bruit dans chaque partie du spectre audio et baisse ces parties, en laissant tranquille ce qui dépasse du bruit.

**À utiliser quand** : vous entendez un souffle régulier ou un bruit blanc
derrière le signal.

Les tonalités continues — une note CW, une porteuse — sont reconnues comme du signal et protégées : NR ne mange donc pas un signal CW comme le ferait un filtre naïf. Effet typique : 10 dB de bruit en moins entre les mots, pour quelques dixièmes de dB perdus sur la parole elle-même.

### Silencieux d'impulsions (NB)

Supprime le bruit impulsionnel : clics, claquements, parasites atmosphériques, allumage et bruit de ligne électrique. Il surveille l'enveloppe audio et ne silence que les échantillons qui la dépassent largement — environ une milliseconde par parasite, avec des rampes d'entrée et de sortie pour que le blanking ne claque pas lui-même.

**À utiliser quand** : vous entendez des clics ou des claquements dus aux lignes
électriques, aux moteurs, aux orages ou à l'allumage des véhicules.

Les notchs de ronflement secteur 50 Hz et 60 Hz suivent ce bouton.

### Suppression du bruit de fond (NS)

Mesure sur plusieurs secondes le plancher de bruit propre à la bande et applique une atténuation fixe à ce qui s'y trouve, plus profonde dans l'aigu que dans le grave. Là où NR réagit d'instant en instant, NS est la main lente et sûre : elle abaisse le souffle de la bande sans changer la sonorité du signal.

**À utiliser quand** : la bande est calme mais soufflante et vous voulez faire
descendre le bruit sans la sonorité « sous-marine » d'une NR agressive.

Active seulement en USB, LSB et AM — CW, FM et les modes numériques restent intacts. Elle remesure le plancher à chaque changement de fréquence ou de mode et se stabilise en quelques secondes.

### Notch automatique (AN)

Trouve et supprime automatiquement les tonalités parasites continues — hétérodynes, porteuses, sifflements — sans que vous ayez à placer un notch à la main. Il s'adapte en continu : plusieurs tonalités peuvent être supprimées à la fois, et une tonalité qui dérive reste notchée.

**À utiliser quand** : vous entendez un sifflement ou une tonalité par-dessus le
signal voulu.

Contourné en CW, où le signal utile *est* une tonalité continue.

**Note sur le retard** : NR et NS ajoutent chacun environ 40 ms de retard audio
lorsqu'ils sont activés (les deux ensemble, environ 80 ms). NB et AN n'en ajoutent aucun. Cela ne concerne que l'écoute, jamais les décodeurs.

### Squelch automatique (SQL)

Coupe l'audio en l'absence de signal :

- **Off** : audio permanent (souffle audible)
- **Auto** : seuil défini automatiquement
- **Manual** : réglage manuel du seuil

**À utiliser quand** : vous surveillez une fréquence en attendant du trafic.

### Réduction de bruit par IA (AI)

Le bouton **AI**, avec un curseur d'intensité à côté, se trouve dans le panneau Audio & Buffer, juste sous SQ. Sur la page /mobile, il est dans l'onglet Audio, sous Squelch. Il retire le bruit de bande de la parole grâce à RNNoise, un petit réseau de neurones entraîné sur la voix.

Tout se passe dans votre propre navigateur : rien n'est envoyé à un serveur extérieur, aucun compte n'est nécessaire, et le récepteur n'a aucun travail supplémentaire.

- **Marche/arrêt** : cliquez sur **AI** ; le bouton devient bleu. Le premier clic télécharge le module (environ 1,3 Mo), et le bouton pulse pendant le chargement.
- **Intensité** : le curseur mélange le son débruité avec l'original — à 100 % tout est traité, les valeurs plus basses ramènent une partie de la bande. La valeur par défaut est 50 %. Vous pouvez le régler même quand AI est éteint.
- **Voyant d'état** : le voyant AI sous l'affichage de fréquence s'allume en cyan quand AI travaille, et apparaît à demi atténué quand AI est actif mais que le mode courant n'est pas un mode phonie.

**À utiliser quand** : vous écoutez de la phonie SSB ou AM sur une bande bruyante. Le souffle entre les mots baisse en général de 10 à 20 dB, tandis que la parole garde son niveau.

Modes phonie seulement — USB, LSB, AM et SAM. En CW, FM, modes numériques et C-QUAM, le son passe sans modification, car le réseau traite une note CW ou de la musique comme du bruit. Comme les quatre commandes de bruit, il n'atteint jamais les décodeurs. Sur des stations très faibles (autour de 0 dB de SNR), la parole peut sembler traitée ; si un signal sonne « aqueux », baissez le curseur. Il ajoute environ 30 ms de retard audio.

### Fonction de zoom

Agrandit l'affichage en cascade :

- **1x** : vue normale (large couverture)
- **2x** : grossissement ×2
- **4x** : grossissement ×4
- **8x** : grossissement ×8

**À utiliser quand** : vous devez mieux voir les signaux ou vous accorder finement.

### Pilotage du transceiver (CAT)

Votre propre transceiver et la page du récepteur peuvent rester sur la même fréquence : tournez le bouton d'accord du poste et la cascade suit, ou cliquez sur un signal dans la cascade et le poste s'y accorde. Cela ne concerne que *votre* session d'écoute ; personne d'autre sur le récepteur n'est affecté.

**Avec Desktop PhantomSDR+ (4.0 ou ultérieur).** L'application de bureau possède un menu **Rig**. *Rig → Rig control...* ouvre une fenêtre où vous choisissez votre poste et la façon de le joindre, et le menu lui-même active ou coupe la synchronisation. Elle synchronise la fréquence, le mode et la largeur de filtre, dans un sens ou dans les deux, et peut couper le son du récepteur pendant que vous émettez. Outre PhantomSDR-Plus, elle pilote de la même façon les récepteurs **KiwiSDR, PA3FWM WebSDR et UberSDR**. Le poste est joint de l'une de ces quatre façons :

- **Intégré** — sans autre logiciel : Icom (CI-V), Yaesu (nouveau CAT et FT-817/857/897), Kenwood, Elecraft, FlexRadio SmartSDR CAT, QRP Labs et autres postes compatibles Kenwood.
- **Hamlib** — tous les postes que connaît Hamlib, plus de 300, choisis dans une liste avec recherche. Les installateurs Windows incluent Hamlib ; sous Linux, installez `libhamlib-utils`.
- **rigctld sur le réseau** — un `rigctld` déjà lancé.
- **flrig** — pour un poste que flrig partage déjà avec fldigi, WSJT-X ou un logiciel de carnet de trafic.

L'application, ses installateurs et son manuel complet se trouvent sur [Desktop PhantomSDR+ (Dropbox)](https://www.dropbox.com/scl/fo/kjwj96zg3kj7dgq4fjef9/APnA3c9hhv4hk3YMGIGjH7s?rlkey=jfiwklly63kv73poalx631pk3&st=m37uvaym&dl=0).

**Avec un navigateur web.** Le [CATsync Tool for WebSDRs](https://catsyncsdr.wordpress.com/) (Windows) couple un poste à la page du récepteur ouverte dans votre navigateur. Il synchronise la fréquence et le mode.

**La largeur de filtre et la coupure du son en émission** fonctionnent sur les récepteurs KiwiSDR, WebSDR et UberSDR, et sur un récepteur PhantomSDR-Plus en 4.1.0 ou ultérieure. Sur un PhantomSDR-Plus plus ancien, la fréquence et le mode se synchronisent toujours ; le filtre non.

Le manuel complet — chaque réglage, les postes pris en charge, comment on empêche les deux côtés de se battre, et le dépannage — est **[Pilotage du transceiver](RIG_CONTROL.md)**.

**Pour les développeurs.** Chaque page de récepteur propose ces fonctions sur `window` ; ce sont elles qu'utilisent les deux outils :

| Fonction | Rôle |
|---|---|
| `catsync_getFrequency()` / `catsync_setFrequency(hz)` | Fréquence d'accord, en Hz |
| `catsync_getMode()` / `catsync_setMode(mode)` | `USB`, `LSB`, `CW`, `CW-L`, `AM`, `FM`, `WBFM` … |
| `catsync_getBandwidth()` / `catsync_setBandwidth(hz)` | Largeur totale de la bande passante, en Hz. À régler après le mode : changer de mode réinitialise la bande passante |
| `catsync_getMute()` / `catsync_setMute(on)` | Coupure du son, via le bouton muet de la page |
| `catsync_ready` | `true` dès que les fonctions sont installées |

Les trois dernières lignes sont nouvelles avec la 4.1.0 ; vérifiez qu'une fonction existe avant de l'appeler.

---

## Modes de démodulation

### AM (modulation d'amplitude)

**Utilisé pour :**
- les communications aéronautiques
- la radiodiffusion AM
- certains trafics radioamateurs
- les communications maritimes

**Caractéristiques :**
- large bande passante (typiquement 10 kHz)
- sensible au bruit
- facile à accorder (il suffit de cliquer sur le signal)

**Bonnes pratiques :**
- utilisez l'AGC rapide (Fast)
- activez le silencieux d'impulsions si vous entendez des clics
- accordez-vous sur le maximum du signal dans la cascade

### QUAM (AM stéréo C-QUAM)

**Utilisé pour :**
- Les émetteurs en ondes moyennes diffusant en AM stéréo

**Caractéristiques :**
- 10 kHz de large, décodé en paire stéréo plutôt qu'en AM mono
- Le libellé du bouton passe au **vert** de lui-même dès que le pilote stéréo de 25 Hz est présent : on voit ainsi quelles stations émettent réellement en stéréo avant de sélectionner le mode
- Depuis l'AM, un nouvel appui bascule en détection synchrone sur la porteuse ; le libellé passe au **jaune** et affiche `SAM`. Un troisième appui revient à l'AM simple
- L'audio C-QUAM est transporté en Opus ; tous les autres modes utilisent FLAC

**Bonnes pratiques :**
- Cherchez le libellé vert sur les signaux puissants en ondes moyennes la nuit
- Si la stéréo est instable, `SAM` est plus stable sur une porteuse faible

### FM (modulation de fréquence)

**Utilisé pour :**
- les relais radioamateurs VHF/UHF
- les services publics (police, pompiers, secours)
- la radio professionnelle bidirectionnelle
- certaines communications par satellite

**Caractéristiques :**
- bande passante étroite (typiquement 12,5 ou 25 kHz)
- excellente immunité au bruit
- « effet de capture » (le signal le plus fort l'emporte)

**Bonnes pratiques :**
- accordez-vous précisément au centre du signal
- utilisez le squelch pour couper l'audio au repos
- désactivez la réduction de bruit (inutile)

### USB (bande latérale supérieure)

**Utilisé pour :**
- le radioamateurisme HF (au-dessus de 10 MHz)
- la plupart des modes numériques HF
- les communications maritimes (au-dessus de 8 MHz)

**Caractéristiques :**
- bande passante étroite (typiquement 2.4 kHz)
- utilisation efficace du spectre
- exige un accord précis

**Bonnes pratiques :**
- utilisez l'AGC lente (Slow)
- accordez-vous sur le bord inférieur du signal dans la cascade
- activez la réduction de bruit si nécessaire

### LSB (bande latérale inférieure)

**Utilisé pour :**
- le radioamateurisme HF (en dessous de 10 MHz)
- certains modes numériques HF
- les communications maritimes (en dessous de 8 MHz)

**Caractéristiques :**
- identique à l'USB mais en image miroir
- convention : LSB sur les bandes HF basses

**Bonnes pratiques :**
- utilisez l'AGC lente (Slow)
- accordez-vous sur le bord supérieur du signal dans la cascade
- activez la réduction de bruit si nécessaire

### CW (onde entretenue / code Morse)

**Utilisé pour :**
- la télégraphie radioamateur
- les balises de radionavigation
- les stations de signaux horaires

**Caractéristiques :**
- bande passante très étroite (100-500 Hz)
- grande efficacité
- nécessite d'apprendre le code Morse pour être compris

**Bonnes pratiques :**
- utilisez un filtre étroit (400-500 Hz)
- accordez-vous précisément sur le centre de la tonalité
- activez le filtre audio pour une meilleure tonalité

### CW-L (CW, bande latérale inférieure)

Le même filtre morse de ±250 Hz que **CW**, mais la tonalité est prise sous la porteuse au lieu d'au-dessus. Utile lorsqu'un signal se copie mieux du côté bas, ou lorsqu'une porteuse brouilleuse se trouve juste au-dessus de celle visée.

**Il n'y a pas de bouton CW-L sur la page de bureau.** Sa rangée de modes est `USB · LSB · CW · AM · QUAM · FM`. CW-L est proposé sur la page simplifiée `/mobile` ; sur le bureau il reste accessible par un lien ou un signet qui le nomme.

### WBFM (FM à large bande)

**Utilisé pour :**
- la radiodiffusion FM (88-108 MHz)
- certaines liaisons descendantes satellite

**Caractéristiques :**
- bande passante très large (200 kHz)
- excellente qualité audio
- haute fidélité

**Bonnes pratiques :**
- accordez-vous exactement sur la fréquence centrale
- aucun squelch nécessaire pour la radiodiffusion
- profitez d'un son de haute qualité !

---

## Décodeurs numériques

PhantomSDR-Plus intègre des décodeurs pour les modes numériques. Pour un guide complet, voir [Décodeurs](DECODERS.md).

Le plus rapide est la rangée de boutons **Decoders** du panneau principal, juste sous **Wheel Tuning Steps** : dix boutons — **FT8, FT4, FT2, JS8, CW, WSPR, FAX, SSTV, NAVTX, RTTY** — qui, en une seule pression, démarrent leur décodeur, basculent l'interrupteur principal Decoder sur ON et amènent la fenêtre du décodeur à l'écran. Le bouton reste bleu tant que le décodeur tourne ; appuyez de nouveau pour l'arrêter et fermer sa fenêtre. Le menu déroulant **Decoder Options** fonctionne exactement comme avant et reste synchronisé avec les boutons.

**RADEL** et **RADEU** (voix numérique RADE v1) disposent de leurs propres boutons à côté du titre **Modes selector** ainsi que dans les fenêtres **Modes** et **Bands**, et fonctionnent de la même manière : une pression pour démarrer, une seconde pour arrêter.

Les décodeurs SSTV, FAX HF, NAVTEX, FSK/RTTY et CW s'exécutent chacun sur leur propre thread d'arrière-plan : activer ou désactiver un décodeur n'interrompt jamais l'audio, et la cascade reste fluide pendant le décodage. Ils reçoivent l'audio prélevé avant l'AGC, la réduction de bruit et la coupure du son — vous pouvez couper le son du récepteur, le décodage se poursuit sans être affecté.

**Tant qu'un décodeur tourne, il conserve le mode et la bande passante.** Normalement le mode suit le plan de bande : accordez dans un segment marqué LSB ou AM et le récepteur bascule. Un décodeur en marche l'emporte sur ce comportement et garde le mode et la bande passante étroite qu'il lui faut, même si vous partez sur une autre bande. Le mode propre à la bande revient dès que vous arrêtez le décodeur, et les boutons de mode restent utilisables à tout moment si vous voulez reprendre la main. Le décodeur CW fait exception : il décode dans le mode où vous écoutez.

### Décodeur FT8, FT4

**Qu'est-ce que FT8, FT4 ?**
- mode numérique radioamateur très répandu
- communication à signaux faibles
- transmissions de 15 secondes pour FT8, de 7,5 secondes pour FT4

**Comment l'utiliser :**
1. Accordez-vous sur les fréquences FT8 ou FT4
2. Sélectionnez le mode USB
3. Activez le décodeur FT8 — appuyez sur le bouton **FT8** ou choisissez-le depuis le menu
4. Observez l'apparition des messages décodés

**Fréquences FT8 courantes (USB) :**
- 160 mètres : 1.840 MHz
- 80 mètres : 3.573 MHz
- 60 mètres : 5.357 MHz
- 40 mètres : 7.074 MHz
- 30 mètres : 10.136 MHz
- 20 mètres : 14.074 MHz
- 17 mètres : 18.100 MHz
- 15 mètres : 21.074 MHz
- 12 mètres : 24.915 MHz
- 10 mètres : 28.074 MHz
- 6 mètres : 50.313 MHz (50.323 MHz pour le DX)

**Fréquences FT4 courantes (USB) :**

- 80 m : 3.575 MHz
- 40 m : 7.0475 MHz
- 30 m : 10.140 MHz
- 20 m : 14.080 MHz
- 17 m : 18.104 MHz
- 15 m : 21.140 MHz
- 12 m : 24.919 MHz
- 10 m : 28.180 MHz
- 6 m : 50.318 MHz

---

### Décodeur JS8

**Qu'est-ce que JS8 ?**
- Le moteur signal faible de FT8, utilisé pour converser au clavier
- Du texte libre au lieu d'échanges figés : les messages longs arrivent sur plusieurs cycles
- Cinq vitesses ; **Normal** (15 s) est la vitesse d'appel et porte presque tout le trafic

**Utilisation :**
1. Accordez-vous sur une fréquence JS8
2. Choisissez le mode **USB**
3. Activez le décodeur JS8 — bouton **JS8** ou depuis le menu
4. Laissez **Speed** sur *Normal* et le sync offset sur **Auto**

**Lire le panneau :**
- Les messages en cours d'arrivée s'affichent en haut en vert avec un curseur clignotant — en Normal, un message peut demander une minute entière
- Les messages terminés se listent en dessous sous la forme `Mode | Hz | dB | Message`, **indicatifs en vert**
- Une ligne grisée et en italique a expiré avant sa dernière trame : le texte est authentique mais peut être tronqué

**Fréquences JS8 courantes (USB) :**

- 160m: 1.842 MHz
- 80m: 3.578 MHz
- 40m: 7.078 MHz
- 30m: 10.130 MHz
- 20m: 14.078 MHz
- 17m: 18.104 MHz
- 15m: 21.078 MHz
- 12m: 24.922 MHz
- 10m: 28.078 MHz

JS8 est bien plus calme que FT8 : une émission toutes les quelques minutes est normale, et les silences ne sont pas une panne. Guide complet : [Décodeurs](DECODERS.md).

---

### Décodeur CW
Appuyez simplement sur le bouton CW et le texte décodé apparaîtra. Appuyez de nouveau sur le bouton CW pour effacer la fenêtre et redémarrer le décodeur.

---

### WSPR

WSPR (Weak Signal Propagation Reporter, prononcé « whisper ») est un mode balise à signaux ultra-faibles qui cartographie les chemins de propagation HF dans le monde entier. Chaque transmission dure environ 110 secondes et tient dans un créneau de 200 Hz de large. Le décodeur attend un créneau complet de 2 minutes aligné sur l'UTC avant de décoder. Activez le décodeur et sélectionnez **WSPR** dans la liste déroulante. Ou appuyez simplement sur le bouton **WSPR**.

---

### FAX HF / WEFAX

Le radiofax HF (également appelé WEFAX) est utilisé par les garde-côtes et les services météorologiques du monde entier pour diffuser des cartes météo, des cartes d'état de la mer et des analyses de surface en ondes courtes. Le décodeur reconstitue l'image ligne par ligne au fur et à mesure de sa réception.

---

### NAVTEX

NAVTEX est le système international de diffusion maritime des informations de sécurité côtière — avertissements de navigation, prévisions météorologiques et avis de recherche et de sauvetage.

---

### FSK / RTTY, PSK31 et Olivia

Un décodeur polyvalent pour les modes texte à bande étroite, avec cinq variantes dans une seule fenêtre : FSK maritime (SITOR), RTTY météo, RTTY amateur, **PSK31** (modulation par déplacement de phase, 31,25 bauds) et **Olivia** (FSK multitonalité avec correction d'erreurs). Le panneau s'adapte à la variante — les commandes de shift, de bauds et de trame disparaissent pour PSK31 et Olivia, et Olivia ajoute un sélecteur Mode et un curseur de squelch.

Deux points à retenir : PSK31 corrige lui-même son erreur d'accord sur environ ±25 Hz, il suffit donc de s'approcher ; Olivia exige que **Mode** (tonalités / largeur de bande) corresponde exactement à l'émission, n'envoie pas de préambule et met donc quelques secondes à se synchroniser avant que du texte apparaisse. Le panneau s'ouvre sur Olivia **8 / 250**.

---

### Grabber QRSS

La QRSS est de la CW envoyée si lentement qu'un seul point dure plusieurs secondes ; elle se regarde plutôt qu'elle ne s'écoute — le grabber trace le signal sur son propre affichage. Il ne figure pas dans le menu des décodeurs : il a sa propre section **QRSS** et peut tourner en même temps qu'un décodeur.

Cliquez sur **🐌 Show**, choisissez ensuite une fenêtre dans la liste **Band** et appuyez sur **Tune** : le récepteur se place sur cette fréquence en **CW**, avec une bande passante taillée pour le mode, et la trace tombe sur la ligne centrale de l'affichage. La fenêtre la plus fréquentée est celle du 30 m (10 140,00 kHz). Réglez **Speed** sur la balise — **QRSS 10** si vous l'ignorez — et soyez patient : un indicatif peut mettre dix minutes à traverser l'écran. Tous les détails dans [Décodeurs](DECODERS.md).

---

### SSTV

La télévision à balayage lent transmet des images fixes sur un canal BLU ordinaire, une ligne à la fois. Activez le décodeur, sélectionnez **SSTV** et accordez-vous sur une fréquence SSTV — 14.230 MHz est la principale fréquence d'appel internationale. Laissez **Mode** sur **Auto** : le décodeur lit l'en-tête VIS de la transmission et, si vous vous êtes accordé après l'en-tête, identifie le mode d'après la synchronisation. Les modes Martin, Scottie et Robot sont pris en charge, et l'image se construit ligne par ligne à mesure qu'elle arrive. Ou appuyez simplement sur le bouton **SSTV**.

### Report automatique des spots et graphiques du serveur

Les décodages FT8, FT4 et WSPR peuvent aussi être téléversés par le serveur lui-même — FT8/FT4 vers PSK Reporter, WSPR vers WSPRnet — par un démon autorun que le sysop démarre depuis le panneau d'administration. Il est indépendant des décodeurs de votre navigateur : il continue de tourner qu'il y ait des auditeurs ou non, et rien de ce que vous décodez dans le navigateur n'est rapporté.

Le sysop le suit à l'aide de deux compteurs, faciles à confondre : les tuiles par décodeur comptent les spots téléversés depuis le dernier démarrage du démon, tandis que le nombre à côté de chaque case bande/mode est le total depuis toujours de cet emplacement et survit aux redémarrages. Le même panneau propose une page **Graphiques** traçant la fréquence du processeur, la charge, la température et les utilisateurs connectés sur les 15 dernières minutes à 24 heures. Les deux sont décrits dans le [guide du panneau d'administration](ADMIN_PANEL_SETUP.md).


---

## Raccourcis clavier

Raccourcis clavier pour une utilisation plus rapide.

---

### Commande de fréquence

L'affichage de fréquence est une rangée de chiffres que l'on pilote directement. **Cliquez d'abord sur un chiffre** : cela le sélectionne, et tout ce qui suit agit sur la sélection.

- **Flèche gauche / droite** : déplace la sélection au chiffre voisin (huit chiffres, de 100 MHz à 10 Hz)
- **Flèche haut / bas** : incrémente ou décrémente le chiffre *sélectionné* de sa valeur de position — 1 MHz sur le chiffre des MHz, 10 Hz sur le dernier
- **0 – 9** : saisit ce chiffre directement à la position sélectionnée

**Molette au-dessus de l'affichage de fréquence** : avance du pas d'accord de la bande (1 kHz sauf indication du plan de bandes). **Shift** pour 1 kHz, **Alt** pour 10 kHz.

**Molette au-dessus de la cascade** : zoome. Maintenez **Ctrl** (ou **Cmd**) ou **Shift** pour accorder au lieu de zoomer, et **Shift + Ctrl** ensemble pour caler sur le kHz entier le plus proche.

> Il n'y a pas de raccourcis Page précédente / Page suivante.

---

## Favoris

Enregistrez vos fréquences préférées pour y accéder rapidement. Vous pouvez aussi exporter la liste des favoris et la sauvegarder localement, puis l'importer dans n'importe quel autre PhantomSDR.

Lorsque favoris et marqueurs se chevauchent :

🔵 Les favoris bleus apparaissent au-dessus <br /> 🟡 Les marqueurs jaunes apparaissent en dessous <br />
✅ Les clics sur les favoris sont prioritaires <br />


### Ajouter un favori

1. Accordez-vous sur la fréquence souhaitée
2. Cliquez sur le bouton « Bookmarks »
3. Cliquez sur « Add Bookmark »
4. Saisissez une description
5. Cliquez sur « Save »

┌──────────────┬────────────────┬────────┐ │ Bookmark name│Label (optional)│ [Add]  │ └──────────────┴────────────────┴────────┘

### Comment l'utiliser :

**Ajouter un favori :**
- Nom : « Local News Station »
- Étiquette : « NEWS »
- Cliquez sur Add

**Affichage dans la cascade :**
- zoomez jusqu'à ce que les marqueurs apparaissent
- vous verrez un cadre bleu marine avec « NEWS » en jaune gras

**Cliquer sur un favori :**
- s'accorde sur la fréquence
- règle le mode de démodulation
- fonctionne exactement comme un clic sur un marqueur

### Gérer les favoris
- **Modifier** : cliquez sur l'icône crayon à côté du favori
- **Supprimer** : cliquez sur l'icône corbeille à côté du favori
- **Exporter** : téléchargez les favoris sous forme de fichier JSON
- **Importer** : envoyez des favoris depuis un fichier JSON

### Partager des favoris

1. Cliquez sur « Export Bookmarks »
2. Partagez le fichier JSON avec d'autres personnes
3. Les destinataires cliquent sur « Import Bookmarks »
4. Ils sélectionnent votre fichier
---

## Utilisation sur mobile

PhantomSDR-Plus fonctionne très bien sur les appareils mobiles !

### Deux vues mobiles

Il y a deux façons d'utiliser le récepteur sur un téléphone :

- **`http://votre_serveur:PORT/mobile`** — la page simplifiée. Pas de cascade, donc environ moitié moins de données. Saisie de fréquence, pas d'accord, modes, S-mètre, bandes, favoris, utilisateurs et chat.
- **La vue étendue** — la disposition téléphone de l'interface principale, avec la cascade et l'ensemble des commandes.

On passe de l'une à l'autre avec les boutons en bas de `/mobile` (**Mobile extended view**, **Full desktop view**) et avec **Simplified mobile** dans la vue étendue.

**Votre fréquence vous suit.** Changer de vue vous laisse sur le même signal — la fréquence et le mode voyagent dans le lien, vous n'atterrissez donc plus sur la fréquence par défaut du récepteur. La barre d'adresse suit également votre accord : recharger la page, la mettre en favori ou envoyer le lien à quelqu'un ramènent exactement à cette fréquence.

**Le mode suit le plan de bande sur les deux pages.** Accordez-vous sur un segment déclaré AM, LSB, USB ou CW — en saisissant une fréquence, en avançant par pas ou en appuyant sur un bouton de bande — et le récepteur bascule sur ce mode, sur la page simplifiée comme dans l'interface complète. Un mode choisi à la main est conservé tant que vous vous déplacez à l'intérieur du même segment, et hors des bandes définies votre mode n'est pas touché. Tant que **RADE** (RADEL/RADEU) tourne, il garde le récepteur : s'accorder ne l'interrompt pas.

Lors d'un changement de vue, votre mode actuel vous accompagne ; si la vue d'arrivée n'a pas d'équivalent, le plan de bande décide pour cette fréquence — une fréquence de radiodiffusion arrive en AM, le 40 m en LSB, un segment CW en CW. `SAM` sur la page simplifiée devient AM avec le détecteur synchrone dans la vue étendue, et inversement. `RADEL` et `RADEU` n'existent que sur la page simplifiée : en la quittant, la fréquence est conservée et le plan de bande choisit le mode.

Une fréquence hors de la couverture du récepteur est ramenée au bord le plus proche : un ancien lien ne peut donc jamais vous laisser hors bande.

### Fonctions propres au mobile

- **Commandes tactiles** : grands boutons et curseurs
- **Balayage pour s'accorder** : balayez vers la gauche/droite sur la cascade
- **Pincement pour zoomer** : pincez la cascade pour zoomer/dézoomer
- **Mode paysage** : tournez l'appareil pour une meilleure vue

### Conseils pour mobile

1. **Utilisez le Wi-Fi** : la diffusion audio consomme des données
2. **Orientation paysage** : meilleure vue de la cascade
3. **Écouteurs** : meilleure qualité audio
4. **Enregistrez vos favoris** : plus facile de revenir sur des stations
5. **Fermez les autres applications** : garantit des performances fluides

### Navigateurs mobiles recommandés

- **Android** : Chrome ou Samsung Internet
- **iOS** : Mozilla
- **Les deux** : veillez à ce que le navigateur soit à jour

---

## Conseils et bonnes pratiques

### Pour une réception optimale

1. **Choisissez des signaux forts** : cherchez l'orange/rouge dans la cascade
2. **Accordez-vous précisément** : cliquez au centre du signal
3. **Sélectionnez le bon mode** : adaptez-le au type de signal
4. **Réglez l'AGC** : rapide pour l'AM, lente pour la BLU
5. **Utilisez NR/NB** : utile en conditions bruyantes

### Trouver de l'activité

1. **Observez la cascade** : les couleurs indiquent la force des signaux
2. **Écoutez sur les fréquences populaires** :
   - 40 m : 7.100-7.300 MHz (LSB)
   - 20 m : 14.200-14.350 MHz (USB)
   - 2 m : 145.200-145.600 MHz (FM)
3. **Consultez la superposition du plan de bandes** : elle montre les attributions de fréquences
4. **Utilisez les favoris** : accès rapide aux fréquences actives

### Comprendre les conditions de propagation

**HF de jour (hautes fréquences) :**
- les bandes hautes fonctionnent mieux (20 m, 15 m, 10 m)
- communications à longue distance (DX) possibles
- stations de radiodiffusion audibles

**HF de nuit :**
- les bandes basses fonctionnent mieux (80 m, 40 m)
- schémas de propagation différents
- stations différentes audibles

**VHF/UHF :**
- principalement à vue directe
- communications locales
- conditions plus stables

### Savoir-vivre

1. **Ne monopolisez pas le récepteur** : d'autres veulent aussi écouter
2. **Utilisez le chat avec respect** : soyez courtois envers les autres utilisateurs
3. **Signalez les problèmes** : aidez l'opérateur à entretenir la station
4. **Ne demandez pas d'assistance technique** : c'est une plateforme d'écoute. Envoyez un message au SysOp pour obtenir de l'aide.

---

## Dépannage

### Aucun son

**Causes possibles :**
1. Navigateur en sourdine → vérifiez les commandes de volume du navigateur
2. Système en sourdine → vérifiez le volume de l'ordinateur
3. Signal faible → accordez-vous sur un signal plus fort (S7+)
4. Mauvais mode → essayez d'autres modes de démodulation

**Solutions :**
1. Cliquez sur un signal fort (orange/rouge dans la cascade)
2. Vérifiez que le navigateur n'est pas en sourdine (icône de coupure dans l'onglet)
3. Essayez une autre fréquence
4. Rechargez la page (F5)

### Son déformé

**Causes possibles :**
1. Signal saturé → signal trop fort
2. Mauvais mode → signal AM écouté en BLU, etc.
3. Interférences → signaux adjacents qui débordent

**Solutions :**
1. Baissez le volume
2. Essayez un autre mode de démodulation
3. Utilisez un filtre plus étroit
4. Éloignez-vous des signaux perturbateurs

### La cascade ne se met pas à jour

**Causes possibles :**
1. Problème réseau → connexion lente ou interrompue
2. Performances du navigateur → trop d'onglets ouverts
3. Serveur surchargé → trop d'utilisateurs

**Solutions :**
1. Vérifiez votre connexion Internet
2. Fermez les onglets inutiles
3. Rechargez la page (F5)
4. Réessayez plus tard, quand il y a moins d'utilisateurs

### Impossible de s'accorder sur une fréquence

**Causes possibles :**
1. Fréquence hors plage → le SDR ne couvre pas cette fréquence
2. Format de saisie incorrect → utilisez le bon format (p. ex. « 14200 » et non « 14.200.000 »)

**Solutions :**
1. Vérifiez la couverture en fréquence du SDR (indiquée sur la page)
2. Utilisez les exemples de format de fréquence fournis
3. Cliquez plutôt dans la cascade

### Son haché ou saccadé

**Causes possibles :**
1. connexion Internet lente
2. charge élevée du serveur
3. problèmes de performances du navigateur

**Solutions :**
1. Fermez les autres applications qui consomment de la bande passante
2. Réessayez en dehors des heures de pointe
3. Fermez les onglets inutiles
4. Utilisez une connexion filaire plutôt que le Wi-Fi

---

## Foire aux questions

### Questions générales

**Q : Ai-je besoin d'un équipement spécial pour utiliser un WebSDR ?**
R : Non ! Juste un ordinateur ou un appareil mobile connecté à Internet.

**Q : L'utilisation du WebSDR est-elle gratuite ?**
R : Oui, la plupart des WebSDR sont gratuits. Ils sont exploités par des bénévoles.

**Q : Puis-je émettre avec un WebSDR ?**
R : Non, le WebSDR est uniquement en réception. Vous ne pouvez pas émettre.

**Q : Quelles fréquences puis-je écouter ?**
R : Cela dépend de la configuration du WebSDR. Consultez les informations de la station.

**Q : Puis-je enregistrer l'audio ?**
R : Certains navigateurs permettent l'enregistrement. Vérifiez les fonctions de votre navigateur.

### Questions techniques

**Q : Quel taux d'échantillonnage le SDR utilise-t-il ?**
R : Cela varie selon la station. Consultez la page d'informations de la station.

**Q : Quelle est la latence ?**
R : Généralement 2 à 5 secondes entre le signal radio et vos haut-parleurs.

**Q : Puis-je ouvrir plusieurs instances ?**
R : En général oui, mais cela peut solliciter le serveur. Soyez prévenant.

**Q : Cela fonctionne-t-il hors ligne ?**
R : Non, le WebSDR nécessite une connexion Internet.

**Q : Quels navigateurs sont pris en charge ?**
R : Chrome, Firefox, Edge, Safari (toutes versions récentes)

### Questions d'utilisation

**Q : Combien de personnes peuvent écouter en même temps ?**
R : Cela dépend de la capacité du serveur. Souvent 50 à 200 utilisateurs ou plus.

**Q : Puis-je voir ce que les autres écoutent ?**
R : Si la fonction est activée, oui. Cherchez les indicateurs « autres utilisateurs ».

**Q : Puis-je discuter avec les autres auditeurs ?**
R : Si l'opérateur a activé le chat. Cherchez la fenêtre de discussion.

**Q : Pourquoi certaines fréquences n'affichent-elles rien ?**
R : Aucun signal sur cette fréquence pour le moment. Essayez-en d'autres !

**Q : Que sont les bandes colorées sur la cascade ?**
R : La superposition du plan de bandes, qui montre les attributions de fréquences.

---

## Ressources

### Pour en savoir plus sur la radio

- **Plans de bandes** : recherchez « amateur radio band plan » + votre région
- **Propagation** : renseignez-vous sur la propagation des ondes HF
- **Modes numériques** : documentez-vous sur FT8, PSK31, RTTY
- **Radioamateurisme** : pensez à passer une licence radioamateur !

### Trouver d'autres WebSDR

- **Annuaire WebSDR** : http://sdr-list.xyz
- **WebSDR.org** : http://websdr.org
- **KiwiSDR** : http://kiwisdr.com/public/

### Obtenir de l'aide

1. **Opérateur de la station** : coordonnées indiquées sur la page
2. **Chat des utilisateurs** : demandez aux autres auditeurs (si disponible)
3. **Forums en ligne** : cherchez des communautés WebSDR
4. **Documentation** : reportez-vous à ce guide !

---

## Annexe : fréquences courantes

### Bandes radioamateurs HF

| Bande | Plage de fréquences | Mode | Activité |
|-------|---------------------|------|----------|
| 160 m | 1.800-2.000 MHz | LSB | Nuit/local |
| 80 m | 3.500-4.000 MHz | LSB | Nuit/régional |
| 40 m | 7.000-7.300 MHz | LSB | Jour/nuit/DX |
| 30 m | 10.100-10.150 MHz | USB | Données/CW uniquement |
| 20 m | 14.000-14.350 MHz | USB | Jour/DX |
| 17 m | 18.068-18.168 MHz | USB | Jour/DX |
| 15 m | 21.000-21.450 MHz | USB | Jour/DX |
| 12 m | 24.890-24.990 MHz | USB | Jour/DX |
| 10 m | 28.000-29.700 MHz | USB | Sporadique/DX |

### Bandes radioamateurs VHF/UHF

| Bande | Plage de fréquences | Mode | Activité |
|-------|---------------------|------|----------|
| 6 m | 50.000-54.000 MHz | USB/FM | Sporadique |
| 2 m | 144.000-148.000 MHz | FM | Très active |
| 70 cm | 420.000-450.000 MHz | FM | Active |

### Bandes de radiodiffusion

| Service | Plage de fréquences | Mode |
|---------|---------------------|------|
| Radio AM | 530-1710 kHz | AM |
| Ondes courtes | 2.3-26.1 MHz | AM |
| Radio FM | 88-108 MHz | WBFM |

### Aviation

| Service | Plage de fréquences | Mode |
|---------|---------------------|------|
| Contrôle du trafic aérien | 118-137 MHz | AM |
| ACARS (données) | 130-136 MHz | Données |

### Maritime

| Service | Plage de fréquences | Mode |
|---------|---------------------|------|
| VHF marine | 156-162 MHz | FM |
| HF marine | 2-22 MHz | USB |

---

## Glossaire

**AGC** : contrôle automatique de gain — ajuste automatiquement les niveaux audio

**AM** : modulation d'amplitude — mode phonie utilisé en aviation et en radiodiffusion

**Bande passante** : la plage de fréquences occupée par un signal

**CW** : onde entretenue — signaux en code Morse

**DX** : communication à longue distance

**FFT** : transformée de Fourier rapide — convertit le domaine temporel en domaine fréquentiel

**FM** : modulation de fréquence — mode phonie pour la VHF/UHF

**HF** : hautes fréquences (3-30 MHz) — bandes à longue portée

**kHz** : kilohertz (1 000 Hz)

**LSB** : bande latérale inférieure — mode phonie pour les bandes HF basses

**MHz** : mégahertz (1 000 000 Hz)

**NB** : silencieux d'impulsions — supprime le bruit impulsionnel

**NR** : réduction de bruit — atténue le bruit de fond

**PSK** : modulation par déplacement de phase — mode numérique

**RTTY** : télétype radio — mode texte numérique

**S-mètre** : indicateur de force du signal

**SDR** : radio logicielle

**SQL** : squelch — coupe l'audio en l'absence de signal

**BLU (SSB)** : bande latérale unique (USB ou LSB)

**USB** : bande latérale supérieure — mode phonie pour les bandes HF hautes

**VHF** : très hautes fréquences (30-300 MHz) — propagation à vue directe

**UHF** : ultra hautes fréquences (300-3000 MHz) — propagation à vue directe

**Cascade** : affichage visuel du spectre radio au fil du temps

---

**Bonne exploration du spectre radio avec PhantomSDR-Plus !**

**73 (meilleures salutations) de SV1BTL & SV2AMK**

Pour les instructions d'installation, voir [INSTALLATION.md](INSTALLATION.md). Pour les détails techniques, voir [PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md).
