# PhantomSDR-Plus — Manuel d'utilisation des décodeurs

Ce guide couvre tous les décodeurs intégrés à PhantomSDR-Plus. Tous les décodeurs partagent la même procédure d'activation, décrite ci-dessous, suivie des instructions de configuration propres à chacun.

---

## Table des matières

1. [Comment démarrer un décodeur](#1-comment-démarrer-un-décodeur)
2. [FT8](#2-ft8)
3. [FT4-FT2](#3-ft4-ft2)
4. [JS8](#4-js8)
5. [CW — code Morse](#5-cw--code-morse)
6. [QRSS Grabber](#6-qrss-grabber)
7. [WSPR](#7-wspr)
8. [FAX HF / WEFAX](#8-fax-hf--wefax)
9. [NAVTEX](#9-navtex)
10. [FSK / RTTY — y compris PSK31 et Olivia](#10-fsk--rtty--y-compris-psk31-et-olivia)
11. [SSTV](#11-sstv)
12. [Conseils généraux](#12-conseils-généraux)

---

## 1. Comment démarrer un décodeur

Tous les décodeurs se trouvent dans la section **Decoder Options**, située sous les commandes du spectrogramme audio, sur le panneau principal.

**Étapes :**

1. Cliquez sur le bouton **Decoder: OFF** pour le faire passer à **Decoder: ON** (il devient bleu lorsqu'il est actif).
2. Ouvrez le menu déroulant qui apparaît à droite du bouton et sélectionnez le décodeur souhaité.
3. Le panneau du décodeur choisi apparaît sous les commandes — suivez les instructions propres à ce décodeur dans la section correspondante de ce guide.
4. Pour arrêter le décodage, sélectionnez **— Select decoder —** dans le menu déroulant, ou cliquez sur le bouton **Decoder: ON** pour le remettre sur OFF.

### Boutons de décodeur en une pression

Le menu déroulant n'est pas la seule voie. Le panneau principal comporte une rangée de boutons **Decoders** — juste sous **Wheel Tuning Steps** — avec un bouton par décodeur :

| Bouton | Décodeur | Bouton | Décodeur |
|---|---|---|---|
| **FT8** | FT8 | **SSTV** | SSTV |
| **FT4** | FT4 | **NAVTEX** | NAVTEX |
| **FT2** | FT2 | **RTTY** | FSK / RTTY |
| **CW** | CW | | |
| **WSPR** | WSPR | **FAX** | HF FAX / WEFAX |

Une pression effectue toute la séquence d'un coup : elle sélectionne le décodeur, met le décodeur sur ON et amène sa fenêtre à l'écran. Le bouton devient bleu tant que son décodeur tourne. **Appuyez de nouveau sur le même bouton pour arrêter le décodeur** — sa fenêtre se ferme avec lui.

**RADEL** et **RADEU** sont volontairement absents de cette rangée. Ce sont des modes de voix numérique et non des décodeurs de texte : ils disposent de leur propre paire de boutons à côté du titre **Modes selector**, ainsi que dans les fenêtres **Modes** et **Bands**. Leur fonctionnement est identique — une pression pour démarrer, une seconde pour arrêter. Voir le [manuel RADE](RADE_README.md).

Les boutons, le menu déroulant et le bouton ON/OFF pilotent le même état : quel que soit celui que vous utilisez, les autres suivent.

> Un seul décodeur peut être actif à la fois. Passer à un autre décodeur arrête automatiquement le précédent.
>
> Le **grabber QRSS** ne fait pas partie de ce menu déroulant : il possède sa propre section **QRSS** et peut fonctionner en même temps qu'un décodeur.

**Le décodage s'exécute en arrière-plan.** SSTV, FAX HF, NAVTEX, FSK/RTTY et CW s'exécutent chacun dans un Web Worker distinct : le travail de décodage n'entre jamais en concurrence avec la lecture audio ou la cascade. Démarrer ou arrêter un décodeur n'interrompt pas l'audio, et l'interface reste réactive pendant la réception d'une image ou d'une page. Tous les décodeurs reçoivent l'audio brut prélevé *avant* l'AGC, la réduction de bruit et la coupure du son — couper le son du récepteur, ou modifier ces réglages selon votre confort d'écoute, n'affecte donc pas le décodage.

**Un décodeur en marche impose le mode et la bande passante.** Normalement le mode suit le plan de bande de `bands-config.js` : amenez l'accord dans un segment marqué LSB ou AM et le récepteur bascule dessus. Tant qu'un décodeur tourne, cela n'a plus lieu. Le décodeur conserve le mode qu'il lui faut (USB pour la plupart, le sien pour RADE) et la bande passante qu'il lui faut — PSK31 environ ±100 Hz, Olivia toute sa largeur, RTTY son shift — et les deux survivent à un changement de fréquence, y compris un saut vers une autre bande. Sans cela, FT8 sur 40 m ferait passer le récepteur en LSB dès que l'accord bouge, et les bandes passantes étroites des décodeurs se rouvriraient au filtre SSB complet.

Le mode propre à la bande revient dès que vous arrêtez le décodeur. Vous pouvez toujours forcer le mode à la main : les boutons de mode sont un choix délibéré et l'emportent toujours. Le décodeur CW fait exception à tout ceci — il décode dans le mode où vous écoutez et ne prend jamais la main sur le récepteur.


### Decoder ID — reconnaître le mode automatiquement

Au-dessus des boutons de décodeur se trouve le cadre **Decoder ID**. Il répond à la question *« qu'est-ce que j'écoute ? »* lorsque vous tombez sur un signal numérique que vous n'arrivez pas à identifier, puis vous propose le décodeur correspondant en un clic.

Il est **désactivé par défaut** et ne coûte rien tant qu'il est éteint. Appuyez sur **On** et laissez le signal accordé. Pendant environ une demi-minute il affiche *Listening…* avec une barre de progression — les mesures de temporisation doivent voir deux cycles FT8 complets avant d'avoir un sens — puis il nomme le mode :

```
Decoder ID [On]   NAVTEX / SITOR-B  99% 📻   170 Hz shift · 100.00 Bd · 43 dB S/N   [ Use NAVTEX ]
```

* Le **mode** et un indice de **confiance**. Vert au-dessus de 75 %, jaune au-dessus de 50 %, orange en dessous — une réponse orange est une piste, pas un verdict.
* **Ce qui a réellement été mesuré** : largeur de bande occupée, écart entre tons, rapidité de modulation, durée de la salve, la grille UTC à laquelle il correspond, rapport signal/bruit. Ce sont les éléments de preuve derrière le verdict, afin que vous puissiez juger par vous-même.
* **Use <mode>** démarre le bon décodeur, exactement comme si vous aviez appuyé sur son bouton — et règle le récepteur pour travailler ce mode. Pour les modes qui vivent dans le panneau FSK, il sélectionne en plus la bonne variante — RTTY, Weather RTTY, PSK31 ou Olivia.
* Les candidats suivants figurent après **or**. Cliquez sur l'un d'eux pour l'essayer : une première réponse erronée ne vous coûte donc rien.
* **📻** signifie que la fréquence sur laquelle vous êtes accordé est une fréquence d'appel connue pour ce mode, et que cela a compté dans le classement.

Il ne change jamais votre décodeur de lui-même. Il ne fait que suggérer. Et dès que vous démarrez un décodeur — depuis la rangée de boutons, depuis la liste déroulante ou depuis le bouton **Use** de Decoder ID lui-même — Decoder ID s'éteint tout seul : son rôle était d'en choisir un, et le décodeur veut maintenant le même signal audio.

**Il règle le récepteur pour le mode.** Choisir un mode, c'est décider de le travailler : le récepteur suit donc. La fréquence accordée passe au milieu de la cascade et la vue s'établit sur environ 100 kHz autour d'elle, la bande latérale devient celle sur laquelle ce mode se travaille et la bande passante se resserre sur la fenêtre où vit ce mode — toute la sous-bande de 3 kHz pour FT8, FT4, FT2 et JS8, 1350–1650 Hz pour WSPR, 250–750 Hz pour NAVTEX, 800–2700 Hz pour HF FAX, 900–2600 Hz pour SSTV et ±250 Hz de part et d'autre de l'accord pour la CW, qui bascule en outre le récepteur en CW. Une bande passante étroite tient les signaux voisins à l'écart du décodeur — exactement ce que vous auriez fait à la main. Deux exceptions : la SSTV conserve la bande latérale qu'elle a choisie elle-même — LSB sur 80 et 40 m par convention, où imposer l'USB inverserait sa correspondance de tons — et les modes FSK conservent la fenêtre que leur propre panneau déduit du shift ou de la largeur de bande de la variante, plus étroite que n'importe quelle valeur fixe. Appuyer sur **Use** pour le décodeur déjà en marche l'arrête toujours, et le récepteur reste alors exactement tel qu'il était.

**Les modes lents demandent plus de temps.** WSPR suit une grille de deux minutes et les images SSTV durent une à deux minutes, donc ces deux-là sont nommés plus tard que les autres — laissez-leur trois ou quatre minutes sur la fréquence. HF FAX et SSTV ne sont par ailleurs reconnus que s'ils sont accordés de la manière habituelle — la bande image entre environ 1500 et 2300 Hz en audio, là où leurs décodeurs l'attendent également. Changer de fréquence relance la mesure à zéro, car tout ce qui a été recueilli décrit la fréquence que vous venez de quitter.

**Ce qu'il reconnaît :** FT8, FT4, JS8, WSPR, CW, NAVTEX/SITOR-B, RTTY à 45,45 Bd, Weather RTTY (DWD), PSK31, Olivia, HF FAX, SSTV et DSC. Cette version ne comporte pas de décodeur DSC, donc DSC est nommé et marqué *no decoder*.

**Recentre & retry.** La position du signal dans la bande passante audio n'a aucune importance entre environ 400 Hz et 2700 Hz. En dehors de cette plage la mesure se dégrade, et un bouton jaune **Recentre & retry** apparaît. Une pression déplace l'accord pour que le signal se retrouve au milieu de la bande passante et lance une nouvelle mesure. C'est un unique déplacement calculé, pas une recherche.

**Trois limites assumées :**

* **FT8, JS8 et FT2 sont le même signal.** Même modulation 8-FSK, même écart entre tons, et JS8 en vitesse Normal utilise la cadence de 15 secondes de FT8. Rien dans le signal lui-même ne les sépare. La fréquence, si : sur une fréquence d'appel FT8 il annonce FT8, sur une fréquence JS8 il annonce JS8, et partout ailleurs il annonce honnêtement la famille — *FT8 / JS8 / FT2*. Démarrez l'un ou l'autre décodeur et voyez lequel produit du texte.
* **Il se tait plutôt que de deviner.** En dessous d'environ 10 dB de rapport signal/bruit, il indique *Nothing above the noise* ou *Not recognised* au lieu de nommer un mode qu'il ne voit pas réellement. C'est délibéré : une réponse fausse et assurée est pire que pas de réponse du tout.
* **Un signal soumis au fading se lit autrement.** WSPR émet 110 secondes sans interruption, soit plus longtemps que ne dure un évanouissement QSB ordinaire : un fading profond découpe donc l'émission en morceaux et son rythme de deux minutes n'y est plus lisible. Il est alors retrouvé par une autre voie — tout l'historique d'écoute est comparé à la grille de deux minutes plutôt qu'aux émissions prises une à une — et la ligne de mesures affiche *120 s grid (through fading)*. C'est une preuve plus faible qu'une émission entendue en entier, aussi la confiance affichée est-elle volontairement plus basse. Un fading assez profond pour noyer le signal dans le bruit ne se rattrape pas du tout. Olivia est plus exigeante que les autres : elle n'est nommée qu'une fois sa rapidité de modulation mesurée, et se tait donc plus tôt.

---

## 2. FT8

**De quoi s'agit-il :** FT8 est un mode numérique à signaux faibles très répandu chez les radioamateurs du monde entier. Les transmissions durent exactement 15 secondes et le protocole peut copier des signaux jusqu'à 20-25 dB sous le plancher de bruit. C'est le mode le plus utilisé pour les contacts à longue distance (DX).

### Fréquences recommandées (USB)

| Bande | Fréquence |
|-------|-----------|
| 160 m | 1.840 MHz |
| 80 m  | 3.573 MHz |
| 40 m  | 7.074 MHz |
| 30 m  | 10.136 MHz |
| 20 m  | 14.074 MHz |
| 17 m  | 18.100 MHz |
| 15 m  | 21.074 MHz |
| 12 m  | 24.915 MHz |
| 10 m  | 28.074 MHz |

### Configuration

1. Accordez-vous sur une fréquence FT8 listée ci-dessus et réglez le mode sur **USB**.
2. Activez le décodeur et sélectionnez **FT8** dans le menu déroulant. Ou appuyez simplement sur le bouton **FT8**.
3. Le panneau **FT8 Messages** apparaît automatiquement en dessous.

### Lecture des résultats

La liste des messages affiche les transmissions décodées à mesure qu'elles arrivent. Chaque cycle de 15 secondes produit un nouveau lot de messages. Le champ **Farthest** (en haut à droite du panneau) indique la plus grande distance décodée durant la session en cours, en kilomètres.

Format de message typique : `CQ DX AA1BB FN31` — un appel CQ de l'indicatif AA1BB situé dans le carré locator FN31.

> **Astuce :** FT8 est étroitement synchronisé dans le temps. Votre navigateur utilise l'horloge de votre ordinateur ; si celle-ci dérive de plus de quelques secondes, le décodage échouera. Gardez l'heure système synchronisée sur NTP.

---

## 3. FT4-FT2

**De quoi s'agit-il :** FT4 est une variante plus rapide de FT8, conçue pour l'exploitation en concours. Chaque cycle de transmission dure 7,5 secondes (la moitié de FT8), ce qui le rend deux fois plus rapide mais exige un signal légèrement plus fort. FT2 est une variante encore plus rapide de FT8. C'est un mode ultrarapide à 77 bits avec des périodes T/R de 3,75 secondes (= la moitié de FT4) — encore expérimental.

### Fréquences recommandées (USB)

| Bande | Fréquence FT4|
|-------|-----------|
| 80 m  | 3.575 MHz |
| 40 m  | 7.047 MHz |
| 30 m  | 10.140 MHz |
| 20 m  | 14.080 MHz |
| 15 m  | 21.140 MHz |
| 10 m  | 28.180 MHz |

| Bande | Fréquence FT2|
|-------|-----------|
|160 m | 1.843 à 1.846 |
|80 m   | 3.578 à 3.581 |
|60 m   | 5.360 (vérifiez la réglementation régionale locale) |
|40 m   | 7.052 à 7.062 |
|30 m   | 10.144 |
|20 m   | 14.084 |
|17 m   | 18.108 |
|15 m   | 21.144 |
|12 m   | 24.923 |
|10 m   | 28.184 |

### Configuration

1. Accordez-vous sur une fréquence FT4 et réglez le mode sur **USB**.
2. Activez le décodeur et sélectionnez **FT4** ou **FT2** dans le menu déroulant. Ou appuyez simplement sur le bouton **FT4** / **FT2**.
3. Le panneau **FT4 Messages** ou **FT2 Messages** apparaît en dessous, avec la même disposition que le panneau FT8.

> **Remarque :** FT4 et FT8 utilisent des formats spectraux différents et ne sont pas interchangeables. Assurez-vous d'être sur une fréquence FT4 lorsque vous utilisez ce décodeur.

---

## 4. JS8

**De quoi il s'agit :** JS8 (le mode utilisé par JS8Call) reprend le moteur signal faible de FT8 et en fait un mode de conversation au clavier. Là où FT8 envoie des échanges figés de 13 caractères, JS8 transmet du texte libre par petits morceaux et recolle les émissions successives en phrases complètes — tout ce qui dépasse une douzaine de caractères arrive donc sur plusieurs cycles de 15 secondes. Sa sensibilité est proche de celle de FT8, ce qui le rend utilisable là où la phonie et la CW ne passent plus.

### Fréquences recommandées (USB)

| Bande | Fréquence |
|-------|-----------|
| 160m | 1.842 MHz |
| 80m  | 3.578 MHz |
| 40m  | 7.078 MHz |
| 30m  | 10.130 MHz |
| 20m  | 14.078 MHz |
| 17m  | 18.104 MHz |
| 15m  | 21.078 MHz |
| 12m  | 24.922 MHz |
| 10m  | 28.078 MHz |

### Vitesses

JS8 propose cinq vitesses. Toutes les stations d'une conversation doivent utiliser la même. **Normal** est la vitesse d'appel et concentre la quasi-totalité du trafic — commencez par elle.

| Vitesse | Cycle | Largeur | Usage |
|---------|-------|---------|-------|
| Slow   | 30 s | 25 Hz  | Trajets très faibles ; la plus sensible |
| Normal | 15 s | 50 Hz  | La vitesse d'appel habituelle |
| Fast   | 10 s | 80 Hz  | Échanges plus rapides, demande plus de signal |
| Turbo  | 6 s  | 160 Hz | Signaux locaux forts |
| Ultra  | 4 s  | 250 Hz | Expérimentale, rarement rencontrée |

### Mise en route

1. Accordez-vous sur une fréquence JS8 et passez en **USB**.
2. Activez le décodeur et choisissez **JS8** dans la liste, ou appuyez simplement sur le bouton **JS8**.
3. Le panneau **JS8 Decoder** apparaît en dessous. Laissez **Speed** sur *Normal*, sauf si vous savez que la station visée en utilise une autre.

### Lire le résultat

Le panneau comporte deux listes.

**Les messages en cours d'arrivée** s'affichent en haut, en vert, avec un curseur clignotant. Un message JS8 peut demander quatre cycles — une minute entière en Normal — c'est donc là que l'on voit la phrase se construire. Rien d'anormal s'il y reste un moment.

**Les messages terminés** remplissent la liste principale, une ligne chacun :

| Colonne | Signification |
|---------|---------------|
| Mode | Toujours `JS8` |
| Hz | Fréquence audio du signal dans la bande passante |
| dB | Rapport signal/bruit dans une largeur de référence de 2500 Hz |
| Message | Le texte décodé ; **les indicatifs sont affichés en vert** |

Messages typiques :

* `SV1BTL KM17: HB` — un heartbeat : la station signale qu'elle est à l'écoute, avec son locator.
* `KN4CRD: K0OG SNR -05` — un message dirigé : KN4CRD indique à K0OG qu'il le reçoit à −5 dB.
* `MP 100W 8M/BALUN JN58KH AUGSBURG, MARTIN` — texte libre, ici une description de station arrivée en quatre cycles.

Une ligne **grisée et en italique** a expiré avant l'arrivée de sa dernière trame. Le texte est authentique, mais peut être tronqué.

### Sync offset

Le curseur **Sync offset** règle le délai après la limite du cycle UTC avant le début de la capture, ce qui compense le retard de la chaîne audio. Laissez **Auto** coché : le décodeur mesure la synchronisation des signaux reçus et s'ajuste tout seul.

### Repères de spectre

La petite bande de spectre du panneau trace un trait vertical jaune à la fréquence de chaque signal décodé au cycle précédent, ce qui permet de lire la colonne Hz directement sur l'affichage.

### Voir ses propres spots

Si le récepteur envoie des spots JS8 à PSK Reporter (voir l'onglet Spot Reporting du panneau d'administration), le bouton **📡 JS8 map** du cadre **Note:** ouvre la carte de PSK Reporter filtrée sur l'indicatif de ce récepteur et le mode JS8 — exactement ce que font **📡 FT8 map** et **📡 FT4 map** pour ces modes.

> **Astuce :** JS8 est bien plus calme que FT8. Un après-midi, une émission toutes les quelques minutes est normale, tout comme de longues périodes sans rien. Laissez-lui cinq à dix minutes avant de conclure à un problème. 20m (14.078) et 40m (7.078) sont les endroits habituels.

> **Astuce :** Comme FT8, JS8 exige une synchronisation stricte et utilise l'horloge de votre ordinateur. Si l'heure système dérive de plus d'une ou deux secondes, rien ne sera décodé. Gardez-la synchronisée par NTP.

---

## 5. CW — code Morse

**De quoi s'agit-il :** le décodeur CW écoute les signaux en code Morse (onde entretenue) et les convertit en texte en temps réel. Il suit automatiquement la fréquence du signal et s'adapte à la vitesse de manipulation de l'opérateur.

### Fréquences recommandées

La CW est active sur toutes les bandes amateurs, généralement dans la partie basse de chaque bande. Endroits courants :

| Bande | Segment |
|-------|---------|
| 40 m  | 7.000–7.040 MHz |
| 20 m  | 14.000–14.070 MHz |
| 15 m  | 21.000–21.080 MHz |

### Configuration

1. Accordez-vous sur un signal CW en utilisant le mode de démodulation **CW** ou **CW-L** selon le cas.
2. Activez le décodeur et sélectionnez **CW** dans le menu déroulant. Ou appuyez simplement sur le bouton **CW**.
3. Le panneau **CW Decoder** apparaît en dessous.

### Lecture des résultats

- L'en-tête du panneau indique la fréquence détectée du signal en Hz (p. ex. `≈ 700 Hz`) et la vitesse de manipulation estimée en mots par minute (p. ex. `· 22 WPM`).
- Si aucun signal n'est détecté, l'en-tête affiche **scanning…**
- Le texte décodé défile en caractères ambrés à chasse fixe. Le curseur clignotant (▋) marque l'endroit où le texte s'écrit actuellement.
- Cliquez sur **Clear** pour effacer la mémoire tampon de sortie.

> **Astuces :**
> - Centrez votre bande passante sur la tonalité CW. Le décodeur fonctionne au mieux lorsque le signal CW se situe entre environ 400 et 900 Hz dans le spectre audio.
> - Une manipulation très rapide ou très lente, ainsi qu'un Morse fortement manipulé à la main (irrégulier), peuvent réduire la précision.
> - Le décodeur donne ses meilleurs résultats sur un signal unique et propre. Un QRM fort provenant de signaux voisins sur la même bande peut le perturber.

---

## 6. QRSS Grabber

**De quoi il s'agit :** le QRSS est de la CW émise si lentement qu'un point dure des secondes au lieu de millisecondes. À cette vitesse le signal n'occupe qu'une fraction de hertz, si bien qu'une analyse suffisamment étroite fait ressortir la trace depuis 20 à 30 dB *sous* le plancher de bruit. Il n'y a rien à lire à l'oreille : le QRSS **se regarde**, il ne s'écoute pas. Le grabber calcule sa propre FFT très longue sur l'audio du récepteur et trace l'affichage classique des grabbers : fréquence sur l'axe vertical, temps défilant de gauche à droite, la colonne la plus récente toujours au bord droit.

L'essentiel de ce que vous verrez provient de balises MEPT (Manned Experimental Propagation Transmitter) — des émetteurs de très faible puissance, souvent quelques centaines de milliwatts dans un fil, qui s'identifient en permanence en morse très lent ou par motifs FSK.

### Où chercher

Les balises QRSS occupent des fenêtres étroites de 100 à 200 Hz près du bas de chaque bande. Inutile de les retenir : le grabber propose une liste **Band** des fenêtres ci-dessous, et en choisir une accorde le récepteur dessus et le prépare pour ce mode (voir *Ouvrir le grabber*).

| Bande | Centre de la fenêtre | Remarque |
|------|---------------|------|
| 30m | 10 140,00 kHz | La fenêtre QRSS principale — de loin la plus fréquentée, de jour comme de nuit |
| 40m | 7 039,90 kHz |  |
| 40m | 7 000,85 kHz | Fenêtre Knights, 7 000,8–7 000,9 kHz |
| 20m | 14 096,90 kHz |  |
| 80m | 3 569,90 kHz |  |
| 80m | 3 568,60 kHz | Ancienne fenêtre |
| 80m | 3 500,85 kHz | Fenêtre Knights, 3 500,8–3 500,9 kHz |
| 160m | 1 837,90 kHz |  |
| 160m | 1 843,30 kHz | Ancienne fenêtre |
| 630m | 476,10 kHz |  |
| 2200m | 137,70 kHz | QRSS / DFCW en LF |
| 60m | 5 288,55 kHz |  |
| 17m | 18 105,90 kHz |  |
| 15m | 21 095,90 kHz |  |
| 12m | 24 925,90 kHz |  |
| 10m | 28 125,70 kHz |  |
| 10m | 28 000,85 kHz | Ancienne fenêtre |
| 10m | 28 322,00 kHz | Variante |
| 6m | 50 294,30 kHz |  |

Plusieurs bandes figurent deux fois parce que deux conventions coexistent réellement. Les fenêtres modernes se placent 200 Hz sous la fréquence WSPR de la bande ; les anciennes fenêtres *Knights* sont ailleurs, et bien plus bas sur 40 et 80 m. Si une bande est calme sur l'une, essayez l'autre.

Ce sont des conventions, non des règlements, et certaines sont régionales — les valeurs du 10 m varient particulièrement. Prenez la liste comme point de départ et suivez l'usage local.

### Ouvrir le grabber

Le grabber QRSS ne figure **pas** dans le menu des décodeurs. Il dispose de sa propre section **QRSS**, à côté des commandes du spectrogramme et des décodeurs.

1. Cliquez sur **🐌 Show**. Le canevas du grabber apparaît et ses commandes se déploient à côté du bouton.
2. Choisissez une fenêtre dans la liste **Band** et appuyez sur **Tune**. Cela fait d'un coup tout ce que le mode réclame : accord sur la fenêtre, passage du récepteur en **CW** et bande passante juste assez large pour la tranche observée. L'affichage indique alors la véritable fréquence QRSS, et les traces tombent sur la ligne centrale de l'écran.
3. Réglez **Speed** sur la durée du point de la balise.
4. **Centre** et **Span** agissent comme avant ; modifier l'un ou l'autre remodèle la bande passante, si bien que l'affichage et le récepteur restent accordés entre eux.
5. Cliquez sur **🐌 Hide** pour arrêter. Le mode normal de la bande revient.

Vous pouvez toujours procéder à la main : accordez en **USB** environ 1 kHz sous la fenêtre pour que les traces tombent vers 800 Hz d'audio. La liste **Band** ne fait que vous épargner le calcul.

Tant qu'une fenêtre de la liste est accordée, le grabber tient le récepteur comme le fait un décodeur : la CW et sa bande passante survivent aux changements de fréquence, et la fenêtre suit l'accord, de sorte que la trace reste sur la ligne centrale pendant que vous parcourez la bande. Il rend le récepteur lorsque vous masquez le grabber, cliquez sur un bouton de mode ou démarrez un décodeur.

### Vitesses

| Réglage | Durée du point | Résolution | Fenêtre d'analyse | Nouvelle colonne toutes les |
|---------|----------------|------------|-------------------|------------------------------|
| QRSS 3  | 3 s  | 0,73 Hz | 1,4 s  | 0,7 s  |
| QRSS 6  | 6 s  | 0,37 Hz | 2,7 s  | 1,4 s  |
| QRSS 10 | 10 s | 0,18 Hz | 5,5 s  | 2,7 s  |
| QRSS 30 | 30 s | 0,09 Hz | 10,9 s | 5,5 s  |
| QRSS 60 | 60 s | 0,05 Hz | 21,8 s | 10,9 s |

Un réglage plus rapide que la balise gaspille de la sensibilité : la trace ressort fine et bruitée. Un réglage plus lent que la balise fond points et traits successifs en une seule barre. Le panneau démarre sur **QRSS 6**, un point de départ raisonnable devant un signal inconnu : plus sensible que QRSS 3, tout en se rafraîchissant plus vite et en tolérant mieux la dérive que QRSS 10. Dès que la forme de la manipulation devient lisible, passez à la vitesse réellement émise par la balise — chaque cran vers un réglage plus rapide coûte 3 dB de sensibilité.

### Commandes

| Commande | Effet |
|----------|-------|
| **Band** | Les fenêtres QRSS du tableau ci-dessus. **Tune** accorde sur celle choisie, en CW avec une bande passante adaptée. |
| **Speed** | Fixe la longueur de la transformée, c'est-à-dire le compromis entre résolution en fréquence et en temps (tableau ci-dessus). |
| **Centre** | Fréquence audio au milieu de l'affichage, 100–3000 Hz. |
| **Span** | Hauteur de la tranche affichée : 20, 50, 100 ou 200 Hz, 100 Hz au démarrage — la largeur d'une sous-bande QRSS. Une tranche plus étroite étale chaque trace sur davantage de pixels. Les tranches larges font entrer dans le panneau plus de bins qu'il n'a de lignes de pixels ; chaque ligne affiche alors le bin le plus fort qu'elle couvre, si bien que rien ne peut se cacher entre les lignes. |
| **Gain** | De −10 à +40 dB. Décale la palette par rapport au plancher de bruit mesuré ; augmentez-le pour éclaircir les traces faibles. |
| **Color** | Rainbow, Green ou Grayscale. |
| **Clear** | Efface le canevas et réinitialise la référence de bruit. |

### Lire l'affichage

Les graduations de fréquence courent le long du bord gauche, la fréquence la plus haute en haut. Sous le canevas, une ligne d'état indique la vitesse choisie, la résolution réellement utilisée (par ex. `0.183 Hz/bin · 5.5 s window`) et la cadence de colonnes (par ex. `2.7 s/column`).

La palette est référencée au bruit **courant**, mesuré en continu sur les parties vides de chaque colonne, et non à un niveau absolu. Changer de volume, d'AGC, d'antenne ou de bande n'oblige donc pas à retoucher le Gain : l'affichage conserve un contraste constant par rapport au bruit de bande du moment. Comme pour les décodeurs, l'audio est prélevé avant l'AGC, la réduction de bruit et le mute ; vous pouvez donc couper le son du récepteur et continuer à regarder.

Ce que signifient les formes :

- Une **porteuse stable** trace une ligne horizontale droite.
- Le **morse lent** trace cette ligne comme une suite de segments courts et longs — points et traits qui se lisent de gauche à droite.
- Les **traces courbes ou dérivantes** viennent d'un oscillateur de balise non stabilisé qui chauffe ou refroidit. C'est normal, et c'est souvent cette signature de dérive qui permet à un observateur régulier de reconnaître une station.
- Les **stries verticales** traversant toute la tranche sont des parasites atmosphériques ou du bruit local, pas du signal.

> **Conseils :**
> - Soyez patient. En QRSS 30 une seule colonne prend 5,5 secondes : un indicatif complet peut demander dix minutes ou plus pour traverser l'écran. Laissez tourner.
> - Accorder depuis la liste **Band** resserre déjà la bande passante autour de la fenêtre. Si vous avez accordé à la main, faites-le vous-même : cela ne change rien à ce que la transformée résout, mais empêche des voisins puissants d'agir sur l'AGC du récepteur.
> - Le grabber est indépendant des décodeurs : vous pouvez le laisser tourner pendant qu'un décodeur travaille sur autre chose.
> - Un span large à vitesse lente est la combinaison la plus lourde ; toute la transformée s'exécute dans le navigateur, alors préférez un span de 50 Hz sur une machine modeste.

---

## 7. WSPR

**De quoi s'agit-il :** WSPR (Weak Signal Propagation Reporter, prononcé « whisper ») est un mode balise à signaux ultra-faibles qui cartographie les chemins de propagation HF dans le monde entier. Chaque transmission dure environ 110 secondes et tient dans un créneau de 200 Hz de large. Le décodeur attend un créneau complet de 2 minutes aligné sur l'UTC avant de décoder.

### Fréquences recommandées (USB, affichée)

| Bande | Fréquence affichée |
|-------|---------------|
| 160 m | 1.836.600 MHz |
| 80 m  | 3.568.600 MHz |
| 40 m  | 7.038.600 MHz |
| 30 m  | 10.138.700 MHz |
| 20 m  | 14.095.600 MHz |
| 17 m  | 18.104.600 MHz |
| 15 m  | 21.094.600 MHz |

### Configuration

1. Accordez-vous sur une fréquence affichée WSPR ci-dessus et réglez le mode sur **USB**.
2. Le signal WSPR occupe la plage audio 1400-1600 Hz. Sélectionner **WSPR** fait le reste pour vous : le récepteur bascule en USB et la bande passante se resserre sur 1350-1650 Hz, ce qui couvre toute la plage explorée par le décodeur. Aucun autre ajustement n'est nécessaire.
3. Activez le décodeur et sélectionnez **WSPR** dans le menu déroulant. Ou appuyez simplement sur le bouton **WSPR**.
4. Le panneau **WSPR-2 Decoder** apparaît en dessous.

### Lecture des résultats

Le panneau affiche une barre de progression pour le créneau de 2 minutes en cours :

- **Barre cyan qui se remplit** — collecte des données du signal (de 0 à 116 s dans le créneau).
- **Barre ambrée qui pulse** — décodage en cours (les ~4 dernières secondes du créneau).
- **Barre vide** — attente de la prochaine minute UTC paire.

Chaque spot décodé avec succès est affiché dans un tableau avec les colonnes suivantes :

| Colonne | Signification |
|---------|---------------|
| UTC | Heure du spot (minute paire) |
| Callsign | La station qui a émis |
| Grid | Locator Maidenhead de l'émetteur |
| Power | Puissance émise en dBm |
| Freq | Fréquence audio exacte (Hz) dans la bande passante WSPR |
| SNR | Rapport signal/bruit en dB |

Cliquez sur **Clear** pour effacer la liste des spots.

> **Astuce :** le décodage WSPR exige une heure système très précise (à ±1 seconde de l'UTC). Le premier créneau après l'activation du décodeur commencera à la prochaine minute UTC paire — une courte attente est normale.

---

## 8. FAX HF / WEFAX

**De quoi s'agit-il :** le radiofax HF (également appelé WEFAX) est utilisé par les garde-côtes et les services météorologiques du monde entier pour diffuser des cartes météo, des cartes d'état de la mer et des analyses de surface en ondes courtes. Le décodeur reconstitue l'image ligne par ligne au fur et à mesure de sa réception.

### Configuration

1. Activez le décodeur et sélectionnez **HF FAX / WEFAX** dans le menu déroulant. Ou appuyez simplement sur le bouton **FAX**.
2. Le panneau **HF FAX / WEFAX Receiver** apparaît en dessous.
3. **Sélectionnez une station** dans la liste déroulante Station. Plus de 20 stations sont disponibles, couvrant l'Europe, l'Asie, l'Océanie et les Amériques (p. ex. DDH3/DDK3 Allemagne, SVJ4/GR Grèce, JMH Japon, NMG États-Unis La Nouvelle-Orléans).
4. Si la station émet sur plusieurs fréquences, sélectionnez la fréquence souhaitée dans le sous-menu **Frequency**.
5. Cliquez sur **▶ Tune** pour accorder automatiquement la cascade sur cette station.
6. Le mode est automatiquement forcé sur **USB**.

### Horaires de diffusion

Lorsqu'une station est sélectionnée, un tableau de compte à rebours **Next Transmissions** apparaît, indiquant les 4 prochaines diffusions programmées en UTC, avec un décompte en direct :

- Normal (gris/vert) — la transmission est à venir.
- **Ambre ⚡** — la transmission commence dans moins de 3 minutes ; armez le décodeur maintenant.
- **Rouge ●** — la transmission commence dans moins de 30 secondes ; la réception est imminente.

### Paramètres

La plupart des stations utilisent les valeurs par défaut standard (marquées ★). Ne les modifiez que si vous savez que la station emploie des réglages non standard.

| Paramètre | Défaut | Description |
|-----------|--------|-------------|
| LPM | 120 ★ | Lignes par minute — la vitesse de rotation du tambour |
| IOC | 576 ★ | Indice de coopération — détermine le nombre de pixels par ligne |
| Shift | 800 Hz ★ | Écart de fréquence entre les tonalités noir et blanc |

### Commandes

- **⇔ Auto-align** — activé par défaut. Se synchronise automatiquement sur le signal de phasage au début de chaque image. Ne le désactivez que si vous rencontrez des problèmes d'alignement sur un signal connu comme bon.
- **⇅ Invert** — inverse le noir et le blanc. À utiliser si l'image apparaît en négatif (zones blanches là où le noir devrait être).
- **↺ Refresh** — efface le canevas et réinitialise le décodeur. À utiliser entre deux transmissions ou si l'image se déchire ou dérive.
- **⤓ Save PNG** — enregistre le canevas actuel sous forme de fichier PNG sur votre ordinateur.

### Indicateurs d'état

En bas de l'image, deux indicateurs de tonalité montrent :

- **300 Hz phasing** — s'allume en cyan lorsque la tonalité de phasage de début d'image est détectée.
- **450 Hz stop** — s'allume en rouge lorsque la tonalité d'arrêt de fin d'image est détectée.

> **Remarque :** l'image défile vers le haut — la ligne reçue la plus récente apparaît toujours en bas du canevas. Si vous voyez **[PHASING]** dans l'en-tête, le décodeur s'est verrouillé sur un nouveau début d'image.

---

## 9. NAVTEX

**De quoi s'agit-il :** NAVTEX est le système international de diffusion maritime des informations de sécurité côtière — avertissements de navigation, prévisions météorologiques et avis de recherche et de sauvetage. Il utilise le FSK à 100 bauds (SITOR-B avec FEC) et est reçu sur des canaux dédiés dans le monde entier.

### Canaux disponibles

| Canal | Fréquence | Usage |
|-------|-----------|-------|
| International | 518 kHz | En anglais, international |
| National | 490 kHz | Diffusions en langue nationale |
| HF (×5) | 4209.5 / 6314 / 8416.5 / 12579 / 16806.5 kHz | NAVTEX HF longue portée |

### Configuration

1. Activez le décodeur et sélectionnez **NAVTEX** dans le menu déroulant. Ou appuyez simplement sur le bouton **NAVTEX**. Le récepteur passe automatiquement en **USB**.
2. Le panneau **NAVTEX Receiver** apparaît.
3. Sélectionnez le canal souhaité dans la liste **Station** (p. ex. `International — 518 kHz`).
4. Cliquez sur **⇒ Tune & Set IF** pour accorder automatiquement la cascade et resserrer la bande passante sur la bonne fenêtre audio. Le mode est réglé automatiquement sur **USB**. La fréquence affichée est placée 500 Hz sous le centre du canal, de sorte que le signal NAVTEX apparaît à 500 Hz en audio.

### Horaires de diffusion

Le tableau des horaires liste toutes les stations connues sur le canal sélectionné avec :

- leur lettre d'identification UIT et le drapeau du pays
- l'heure de la prochaine diffusion en UTC
- un décompte en direct jusqu'à la prochaine transmission
- **Ambre ⚡** à moins de 2 minutes / **Rouge ●** à moins de 30 secondes — armez le décodeur maintenant

### Lecture des résultats

Le texte décodé apparaît en caractères sarcelle à chasse fixe. Les limites des messages sont clairement marquées :

```
━━ ZCZC MA12 ━━
... message content ...
━━ NNNN ━━
```

`ZCZC` marque le début d'un message. Les trois caractères qui suivent identifient la station (`M`), le sujet (`A` = avertissements de navigation) et le numéro d'ordre (`12`). `NNNN` marque la fin.

Cliquez sur **Clear** pour effacer la mémoire tampon des messages.

> **Remarque :** NAVTEX fonctionne sur des fréquences MF et LF (518/490 kHz). La portée de réception est généralement de 200 à 400 milles marins depuis l'émetteur. Les canaux HF (4-17 MHz) offrent une portée bien supérieure.

---

## 10. FSK / RTTY — y compris PSK31 et Olivia

**De quoi s'agit-il :** un décodeur polyvalent pour les modes texte à bande étroite, avec cinq variantes de fonctionnement accessibles depuis un seul menu. Trois d'entre elles sont du véritable FSK (Frequency-Shift Keying) : FSK maritime (SITOR), RTTY météo et RTTY amateur. Les deux autres ne sont pas du FSK du tout mais partagent la même fenêtre : **PSK31**, qui est une modulation par déplacement de phase, et **Olivia**, qui est un FSK multitonalité avec correction d'erreurs. Chaque variante est fournie avec un préréglage adapté à ses paramètres standard.

### Variantes et préréglages

| Variante | Centre | Shift | Bauds | Trame | Codage |
|----------|--------|-------|-------|-------|--------|
| FSK maritime / SITOR | 500 Hz | 170 Hz | 100 | 7N1 | CCIR-476 |
| RTTY météo | 1000 Hz | 450 Hz | 50 | 5N1.5 | ITA2 |
| RTTY amateur | 1000 Hz | 170 Hz | 45.45 | 5N1.5 | ITA2 |
| PSK31 (BPSK) | 1000 Hz | — | 31.25 | — | Varicode |
| Olivia (MFSK) | 1000 Hz | — | voir Mode | — | 7 bits + FEC |

Le panneau s'adapte à la variante choisie. **Shift**, **Baud**, **Framing**, **Encoding**, **Invert mark / space** et **Auto shift detect** sont masqués pour PSK31 et Olivia, car aucun de ces deux modes ne possède de paire de tonalités mark/space ni de trame de type UART. À leur place, **Center audio** devient un champ numérique libre (la porteuse peut se trouver n'importe où dans la bande passante), et Olivia ajoute un sélecteur **Mode** et un curseur **Squelch**.

### Réglage

1. Activez le décodeur et sélectionnez **FSK / RTTY** dans le menu. Ou appuyez simplement sur le bouton **RTTY**.
2. Le panneau du décodeur apparaît. Son titre suit la variante — *FSK / RTTY Decoder*, *PSK31 Decoder* ou *Olivia Decoder*.
3. Sélectionnez la **Variant**. Les paramètres se mettent à jour automatiquement.
4. Pour Olivia, réglez **Mode** (tonalités / largeur de bande) pour correspondre à l'émission — voir les notes sur Olivia ci-dessous.
5. Utilisez le menu **Known frequency** pour choisir une fréquence courante de la variante sélectionnée, puis cliquez sur **Tune** pour vous y rendre.
6. Affinez l'accord jusqu'à ce que le texte décodé devienne stable et lisible.

### Fréquences connues par variante

**FSK maritime / SITOR**
- 518,0 kHz — NAVTEX international
- 490,0 kHz — NAVTEX national
- 4209,5 / 6314,0 / 8416,5 / 12579,0 / 16806,5 / 22376,0 kHz — SITOR HF

**RTTY météo**
- 4583,0 / 7646,0 / 10100,8 / 11039,0 / 14467,3 kHz — DWD (service météorologique allemand)

**RTTY amateur**
- 3590 kHz (80 m), 7043 kHz (40 m), 10143 kHz (30 m), 14083 kHz (20 m), 21083 kHz (15 m), 28083 kHz (10 m)

**PSK31**
- 3580,15 kHz (80 m), 7040,15 kHz (40 m), 10142,15 kHz (30 m), 14070,15 kHz (20 m), 18100,15 kHz (17 m), 21080,15 kHz (15 m), 24920,15 kHz (12 m), 28120,15 kHz (10 m)

**Olivia**
- 3577,75 kHz (80 m), 7073,75 kHz (40 m), 10142,25 kHz (30 m), 14075,5 kHz (20 m), 18103,75 kHz (17 m), 21075,75 kHz (15 m), 24921,75 kHz (12 m), 28123,75 kHz (10 m)

### Paramètres

| Paramètre | S'applique à | Description |
|-----------|--------------|-------------|
| Center audio (Hz) | toutes | La fréquence audio du milieu entre mark et space ; pour PSK31 la porteuse, pour Olivia le centre du bloc de tonalités. Un menu déroulant pour les variantes FSK, un champ libre pour PSK31 et Olivia |
| Shift (Hz) | FSK seulement | Écart de fréquence entre les tonalités mark et space |
| Baud | FSK seulement | Débit de symboles |
| Framing | FSK seulement | Bits de données, parité, bits d'arrêt (par ex. 7N1 = 7 données, sans parité, 1 arrêt) |
| Encoding | FSK seulement | Jeu de caractères (CCIR-476, ITA2/Baudot ou ASCII) |
| Invert mark / space | FSK seulement | Permute les tonalités mark et space |
| Auto shift detect | FSK seulement | Tente de mesurer automatiquement le shift à partir du signal reçu |
| Mode (tonalités / Hz) | Olivia seulement | Nombre de tonalités et largeur de bande — doit correspondre exactement à l'émission |
| Squelch (FEC S/N) | Olivia seulement | Force que doit atteindre la correction d'erreurs avant que du texte soit affiché |

### Mesures du signal

La barre d'état affiche des mesures en direct, et les champs changent selon la variante :

| Variante | Champs affichés |
|----------|-----------------|
| Variantes FSK | **Mark / Space** (fréquences de tonalité mesurées), **SNR**, **Lock**, **Timing** |
| PSK31 | **Carrier** (Hz, après correction automatique de fréquence), **IMD** (dB), **S/N**, **Lock**, **Timing** |
| Olivia | **Centre** (Hz), **Mode**, **S/N**, **FEC** (%), **Sync** |

`Timing`/`Sync` affiche `LOCKED`/`SYNCED` dès que le décodeur suit le signal, et `SEARCH` tant qu'il le cherche encore.

### Commandes supplémentaires

- **⇒ Set IF Band-Pass** — resserre la bande passante du récepteur autour du signal. La largeur suit la variante : mark/space plus marge pour le FSK, environ ±100 Hz pour PSK31, et toute la largeur du bloc de tonalités plus marge pour Olivia.
- **⟳ Auto-tune Center** — recherche automatique du signal. Pour les variantes FSK elle cherche une paire équilibrée de tonalités, pour PSK31 elle trouve la porteuse, et pour Olivia le bloc le plus fort de la largeur de bande sélectionnée.

### Notes sur PSK31

PSK31 est le mode clavier à clavier le plus répandu en HF. Il ne fait que 62 Hz de large, si bien que plusieurs QSO cohabitent côte à côte dans les quelques centaines de hertz autour de la fréquence de rassemblement ; l'accord consiste à choisir une trace dans le groupe visible sur la cascade.

- Le décodeur corrige lui-même son erreur d'accord sur environ **±25 Hz**, il suffit donc de s'approcher. **Carrier**, dans la ligne de mesures, indique où il s'est réellement stabilisé.
- **IMD** mesure la qualité de l'émetteur, pas la réception : un signal propre affiche environ −20 dB ou mieux. Une mauvaise valeur signifie que la station d'en face surmodule, non que vous êtes mal accordé.
- Le texte apparaît caractère par caractère sans correction d'erreurs ; un signal faible se dégrade donc en lettres fausses occasionnelles plutôt que de s'interrompre.

### Notes sur Olivia

Olivia échange la vitesse contre la robustesse. Il est bien plus lent que PSK31 mais décode des signaux inaudibles à l'oreille, ce qui le rend populaire pour les signaux faibles et les liaisons à grande distance.

- **Le réglage Mode doit correspondre exactement à l'émission.** Une combinaison tonalités/largeur de bande erronée ne décode absolument rien — pas du texte brouillé, mais le silence. Le panneau s'ouvre sur **8 / 250**, la configuration étroite laissée en veille sur les fréquences d'appel ; **16 / 500** et **32 / 1000** sont les deux autres d'usage courant, et **16 / 1000** est également proposé.
- Olivia n'envoie pas de préambule, le décodeur doit donc chercher la synchronisation. **Comptez quelques secondes** après l'accord avant que du texte apparaisse. Le champ **Sync** affiche `SEARCH` jusqu'au verrouillage.
- La correction d'erreurs travaille par blocs : le texte arrive **par rafales plutôt qu'en flux continu**, avec un retard de plusieurs blocs entre l'émission et l'affichage.
- **Squelch (FEC S/N)** définit le degré de confiance que doit atteindre la correction d'erreurs avant d'afficher. La valeur par défaut de 4,0 tient le bruit à l'écart ; 3,0 est le plancher, en dessous duquel le bruit aléatoire commence à imprimer des caractères isolés. Un bon signal affiche 8–9 sur l'indicateur **FEC**, il reste donc une large marge pour relever le squelch sur une bande encombrée.

> **Note sur le mode :** le décodeur prend le contrôle du mode de démodulation et de la bande passante FI tant qu'il est actif. Les deux sont rétablis automatiquement à sa désactivation. Les cinq variantes utilisent l'**USB**.
>
> **Note sur la polarité (variantes FSK uniquement) :** pour le RTTY météo, il faut généralement cocher **Invert mark / space**. Pour le FSK maritime (type SITOR/NAVTEX) et le RTTY amateur, laissez la case décochée — le RTTY amateur émet le mark sur la radiofréquence la plus haute, et l'USB le conserve comme la tonalité audio la plus haute, ce qui correspond précisément au cas décoché. Si le texte décodé est brouillé, la première chose à essayer est de basculer cette case. Elle est masquée pour PSK31 et Olivia, qui n'ont pas de paire mark/space.
>
> **Note sur lettres/chiffres (variantes FSK uniquement) :** le code Baudot gère les lettres et les chiffres dans deux états distincts, et le bruit peut faire basculer le décodeur dans le mauvais — ce qui brouille tous les caractères suivants, pas seulement celui qui a été altéré. Le décodeur revient donc aux lettres à chaque espace ; c'est la pratique courante et cela répare un basculement corrompu en un ou deux mots au lieu d'une ligne entière. En contrepartie, les groupes de chiffres séparés par des espaces exigent que l'émetteur répète le passage aux chiffres après chaque espace, ce que font normalement les émetteurs.

---

## 11. SSTV

**De quoi s'agit-il :** la télévision à balayage lent transmet des images fixes sur un canal phonie SSB ordinaire, une ligne à la fois, sous forme d'une tonalité modulée en fréquence entre 1500 Hz (noir) et 2300 Hz (blanc). Une image complète prend entre 36 secondes et 4 minutes 30 selon le mode.

### Fréquences recommandées (USB)

| Bande | Fréquence | Mode | Remarques |
|-------|-----------|------|-----------|
| 20 m | 14.230 MHz | USB | La principale fréquence d'appel SSTV internationale — de loin la plus active |
| 20 m | 14.233 MHz | USB | Secondaire, utilisée quand 14.230 est occupée |
| 15 m | 21.340 MHz | USB | |
| 10 m | 28.680 MHz | USB | Active pendant les ouvertures de bande |
| 40 m | 7.171 MHz | LSB | |
| 80 m | 3.845 MHz | LSB | Régionale, en soirée |

**La bande latérale est choisie pour vous.** Le démarrage du décodeur sélectionne la **LSB en dessous de 10 MHz** et l'**USB au-dessus**, selon l'usage amateur habituel. Sur la mauvaise bande latérale, la correspondance des tonalités est inversée et l'image ne sera pas décodée. Si vous rencontrez une station qui ignore la convention, changez simplement la bande latérale à la main — le décodeur reste actif, efface l'image et repart à zéro avec le nouveau réglage.

### Configuration

1. Activez le décodeur et sélectionnez **SSTV** dans le menu déroulant. Ou appuyez simplement sur le bouton **SSTV**. Le récepteur change automatiquement de bande latérale — USB au-dessus de 10 MHz, LSB en dessous.
2. Accordez-vous de sorte que les tonalités de l'image tombent au milieu de la bande passante. Un signal correctement accordé a ses impulsions de synchronisation à 1200 Hz et le contenu de l'image entre 1500 et 2300 Hz.
3. Laissez **Mode** sur **Auto**, sauf si vous savez déjà ce qui est transmis. L'image se construit ligne par ligne au fur et à mesure de la réception.

### Modes

| Réglage | Image | Durée |
|---------|-------|-------|
| **Auto** | Détecté automatiquement | — |
| Martin M1 / M2 | 320×256 couleur | 114 s / 58 s |
| Scottie S1 / S2 | 320×256 couleur | 110 s / 71 s |
| Scottie DX | 320×256 couleur | 269 s |
| Robot 36 / 72 | 320×240 couleur | 36 s / 72 s |

**Auto** fonctionne de deux façons : il lit l'**en-tête VIS** — le code numérique du mode envoyé dans les 300 premières millisecondes d'une transmission — et, si l'en-tête a été manqué (vous vous êtes accordé trop tard, ou il a été perdu dans le QSB), il identifie le mode d'après la synchronisation des impulsions. Sélectionner un mode précis force ce mode, mais le décodeur vérifie tout de même la synchronisation avant de dessiner quoi que ce soit : un mauvais choix ne produit donc aucune image plutôt que du bruit.

### Lecture des résultats

La ligne d'état sous les commandes indique ce que fait le décodeur :

| État | Signification |
|------|---------------|
| `Waiting for VIS / AUTO lock` | À l'écoute ; rien d'identifié pour l'instant |
| `Martin M1? verifying sync…` | Un candidat a été trouvé et est confirmé sur les lignes suivantes |
| `Martin M1 lock (VIS)` | Verrouillé d'après l'en-tête VIS |
| `Martin M1 lock (AUTO)` | Verrouillé d'après la synchronisation |
| `Martin M1 lock (MANUAL)` | Démarré par le bouton **⏺ Force** |
| `Candidate rejected (no sync)` | Le candidat n'a pas été confirmé — normal sur du bruit |
| `— sync lost, resetting` | Le signal a disparu en cours d'image |
| `Frame complete` | L'image complète a été reçue |

Le mode détecté apparaît aussi en vert à côté du titre **SSTV**, et le compteur de lignes indique la progression.

### Commandes

| Bouton | Action |
|--------|--------|
| **▶ Start** | Arme le décodeur. Il ne dessine pas d'image de lui-même — un verrouillage doit encore provenir de l'en-tête VIS ou de la détection de synchronisation. |
| **■ Stop** | Arrête le décodage. |
| **↺ Reset** | Efface le canevas et réarme sur place. À utiliser entre deux images ou après un réaccord. |
| **⏺ Force** | Commence à dessiner **immédiatement** dans le mode sélectionné dans la liste, en sautant entièrement le VIS et la détection de synchronisation. Disponible uniquement quand Mode n'est pas sur **Auto**. |
| **💾 Save** | Enregistre l'image actuelle au format PNG. |

**Quand utiliser Force.** Si vous voyez une image dans la cascade mais que le décodeur ne parvient pas à s'y verrouiller — mode inhabituel, signal trop faible ou trop déformé pour les détecteurs, ou en-tête manqué — sélectionnez le mode à la main et appuyez sur **⏺ Force**. L'image est calée au moment du clic, et le badge de mode affiche `MANUAL` pour que vous puissiez la distinguer d'un verrouillage VIS ou AUTO. Le décodeur se recale tout de même sur une véritable impulsion de synchronisation s'il en trouve une : un clic légèrement en avance ou en retard est donc corrigé.

Comme Force contourne toutes les vérifications de sécurité, il peindra volontiers du bruit si vous l'actionnez sur un canal vide, et il ne s'arrêtera pas tout seul — appuyez sur **■ Stop** ou **↺ Reset**.

### Remarques

- **Le bruit ne déclenche pas le décodeur.** Les parasites atmosphériques, les étincelles et le bruit du secteur suffisaient autrefois à déclencher un décodage. Chaque étape de détection vérifie désormais que la tonalité est bien une tonalité, et confirme le candidat sur les lignes suivantes avant de dessiner le moindre pixel. Attendez-vous à ce que le décodeur reste silencieux sur une bande vide.
- **L'image dérive en diagonale si vous êtes décalé en fréquence.** La SSTV ne pardonne pas les erreurs d'accord. Si les lignes penchent, ajustez la fréquence par petits pas et laissez l'image suivante démarrer.
- L'équilibre des couleurs et la netteté sont fixes ; il n'y a aucun réglage à faire.

---

## 12. Conseils généraux

**Decoder: ON doit être activé en premier.** Le menu déroulant est désactivé (grisé) tant que vous n'avez pas cliqué sur le bouton Decoder pour l'activer.

**Un décodeur à la fois.** Sélectionner un nouveau décodeur dans le menu arrête automatiquement celui qui était actif et annule les changements de mode ou de bande passante qu'il avait effectués.

**Le mode est géré pour vous.** Le FAX HF et NAVTEX basculent le récepteur en USB dès que vous les sélectionnez, la SSTV choisit la bande latérale d'après la bande (LSB sous 10 MHz, USB au-dessus), et FAX, NAVTEX et FSK ajustent aussi la bande passante lorsque vous cliquez sur leur bouton Tune. FT8, FT4, FT2, JS8 et WSPR font de même dès que vous les sélectionnez — depuis la rangée de boutons ou la liste déroulante : le récepteur bascule en USB et prend leur propre bande passante — toute la sous-bande de 3 kHz pour la famille FT8, 1350-1650 Hz pour WSPR. Lorsque vous arrêtez le décodeur, le mode par défaut de la bande est restauré.

**Activer un décodeur n'interrompt plus l'audio.** Les décodeurs s'exécutent sur leurs propres threads : il n'y a donc ni blanc, ni clic, ni coupure lorsque l'un démarre, s'arrête ou est remplacé par un autre.

**La précision de l'horloge système compte.** FT8, FT4 et WSPR sont critiques en temps. Ils décodent dans des fenêtres fixes alignées sur l'UTC. Si l'horloge de votre ordinateur est décalée de plus de 1 à 2 secondes, les taux de décodage chuteront nettement. Utilisez un client NTP pour garder votre horloge précise.

**Les filtres de bruit n'atteignent pas les décodeurs.** NR, NB, NS et AN sont
des aides à l'écoute, pour vos oreilles seulement. Tous les décodeurs — FT8, FT4/FT2, CW, WSPR, FAX, NAVTEX, FSK/RTTY/PSK31/Olivia, SSTV et le grabber QRSS — prennent l'audio *avant* ces filtres : réglez-les donc comme cela sonne le mieux, sans vous soucier de la qualité de décodage. Pour la même raison, les décodeurs continuent de tourner pendant que le récepteur est coupé ou silencé : vous pouvez éteindre le haut-parleur et laisser un décodeur, ou une capture QRSS nocturne, poursuivre. La seule chose qui suive réellement ce que vous entendez est le spectrogramme audio, qui est fait pour montrer l'audio filtré.

**La qualité du signal prime sur sa force.** La plupart de ces décodeurs sont conçus pour les signaux faibles. Une bande plus calme avec moins de bruit est souvent plus productive qu'un signal fort noyé dans les interférences. Utilisez la cascade et les commandes de bande passante pour repérer et éviter le QRM avant d'activer un décodeur.

**Utilisez les boutons Refresh ou Clear sans hésiter.** Les images FAX dérivent si la fréquence affichée est légèrement décalée, et les décodeurs de texte accumulent des caractères parasites. Un nouveau départ après des ajustements d'accord produit souvent un résultat beaucoup plus propre.

### Report automatique des spots et graphiques du serveur

Les décodages FT8, FT4 et WSPR peuvent aussi être téléversés par le serveur lui-même — FT8/FT4 vers PSK Reporter, WSPR vers WSPRnet — par un démon autorun que le sysop démarre depuis le panneau d'administration. Il est indépendant des décodeurs de votre navigateur : il continue de tourner qu'il y ait des auditeurs ou non, et rien de ce que vous décodez dans le navigateur n'est rapporté.

Le sysop le suit à l'aide de deux compteurs, faciles à confondre : les tuiles par décodeur comptent les spots téléversés depuis le dernier démarrage du démon, tandis que le nombre à côté de chaque case bande/mode est le total depuis toujours de cet emplacement et survit aux redémarrages. Le même panneau propose une page **Graphiques** traçant la fréquence du processeur, la charge, la température et les utilisateurs connectés sur les 15 dernières minutes à 24 heures. Les deux sont décrits dans le [guide du panneau d'administration](ADMIN_PANEL_SETUP.md).

---

*PhantomSDR-Plus — fork sv1btl — [phantomsdr.no-ip.org](http://phantomsdr.no-ip.org:8900)*
