# PhantomSDR-Plus — Comment modifier les variantes du frontend

*(après la fusion des quatre fichiers `App__*_smeter_.svelte` en un seul `App.svelte`)*

---

## 1. Ce que sont les variantes

Deux choix indépendants, donnant quatre combinaisons :

```
smeter = "analog"     l'instrument à aiguille mobile
       = "digital"    l'instrument à barre segmentée

layout = "v1"         sélecteur de modes au-dessus, sélecteur de bande en dessous
       = "v2"         sélecteur de bande au-dessus, sélecteur de modes en dessous
                      (déplace aussi la rangée de boutons d'accord fin sur mobile)
```

Les quatre tiennent dans **une seule** construction, servie à `/`. Le sélecteur ⚙️ en haut à droite bascule de l'une à l'autre dans la page en cours d'exécution : il affecte les props `smeter`/`layout` d'`App.svelte`, donc rien n'est rechargé et l'audio, la cascade et les décodeurs continuent de tourner. Le choix est conservé par navigateur dans `localStorage` sous `phantom.variant`, et il l'emporte sur la valeur par défaut de la construction à la visite suivante.

La variante choisie dans `recompile.sh` est donc la variante de **départ** : ce que voit un visiteur qui arrive pour la première fois, avant de toucher au menu.

| URL | ce que c'est |
|-----|--------------|
| `/` | la page bureau ; les quatre variantes, commutables à l'exécution |
| `/mobile/` | *page distincte, construite par `build-mobile.sh` — ce n'est pas une variante* |

> Jusqu'au 10/08/2026, chaque variante était sa propre construction sous `/analog/`, `/digital/`, `/v2-analog/` et `/v2-digital/`, et le sélecteur naviguait entre elles — d'où le rechargement de la page et la coupure du son à chaque changement. Ces constructions n'existent plus ; chacun des quatre chemins ne contient plus qu'un petit `index.html` qui redirige vers `/`, écrit par `frontend/make-redirect-stubs.sh` à chaque construction pour que les anciens signets continuent de fonctionner.

La variante n'est écrite dans **aucun** fichier source. `src/main.js` est un point d'entrée fixe qui transmet au composant deux valeurs définies à la construction :

```js
const app = new App({
  target: document.getElementById('app'),
  props: { smeter: __PHANTOM_SMETER__, layout: __PHANTOM_LAYOUT__ }
})
```

`vite.config.js` les remplit au moment de la construction, en prenant la première de ces sources qui est définie :

1. **`PHANTOM_SMETER` / `PHANTOM_LAYOUT`** — variables d'environnement. Plus rien ne les définit depuis la suppression des constructions par variante ; elles restent utilisables pour une construction ponctuelle avec une autre variante de départ.
2. **`frontend/variant.json`** — la valeur par défaut du site, écrite par `recompile.sh`. La construction de la racine (`/`) ne transmet aucune variante et atterrit donc ici.
3. **`analog` / `v1`** — la valeur de repli.

Ces deux valeurs ne sont que la graine. `App.svelte` les écrase à l'initialisation depuis `localStorage` si le visiteur a déjà choisi une variante, et le sélecteur ⚙️ les réaffecte à chaque changement.

Dans `App.svelte`, les props sont converties en deux drapeaux aux lignes 20-21 :

```js
$: isAnalog = smeter !== "digital";
$: isV2     = layout === "v2";
```

Utilisez ces deux drapeaux — jamais `smeter`/`layout` directement — pour que tout le fichier se lise de la même façon.

---

## 2. Le rôle de chaque fichier

### `frontend/src/main.js` — 12 lignes

Le point d'entrée. Rien d'autre que l'instanciation de App et les deux valeurs `__PHANTOM_*__` qu'elle transmet comme props. Il est **constant** — ni `recompile.sh` ni les scripts de construction ne le réécrivent désormais, et c'est cela qui permet de construire les variantes en même temps.

> **Ne placez pas de code applicatif ici.** C'est le fichier d'entrée, pas un endroit pour de la logique.

### `frontend/src/App.svelte` — ~17130 lignes

Toute l'application : cascade, accord, décodeurs, favoris, panneaux, disposition bureau ET la disposition adaptative pour téléphone. Presque toutes les modifications que vous ferez se font ici.

### `frontend/src/lib/SMeterAnalog.svelte` — 824 lignes

L'instrument à aiguille mobile, complet : tracé du cadran, aiguille, la bascule cadran clair/sombre et sa clé localStorage, et le lissage de l'aiguille.

- Prop d'entrée : `dbm` — la puissance CALIBRÉE en dBm.
- Accepte aussi : `mobile` — attributs de canvas réduits pour la disposition téléphone.
- Réglage : `SMOOTH_TIME_MS` à la ligne 55. Plus bas = aiguille plus rapide, plus haut = plus lisse. Actuellement 16 (une image à 60 fps, en pratique le plancher).

#### Les trois cadrans — et `smeter_theme.sh`

L'instrument analogique possède trois fonds, tous dessinés par le même code :

```
dark      le métal brossé sombre d'origine
amber     un cadran clair, gris pâle
vintage   un cadran chaud, ambre vieilli
```

**À ne pas confondre avec la variante `smeter = analog / digital` ci-dessus.** La variante choisit *quel composant d'instrument* est affiché ; le cadran choisit *comment* l'analogique est peint. Ils sont stockés sous des clés localStorage différentes (`phantom.variant` et `smeterTheme`) et se règlent à des endroits différents.

**Côté visiteur.** Le canvas de l'instrument est un bouton (`role="button"`, également Entrée/Espace au clavier, avec l'indication « click to switch style » en dessous). Chaque clic fait défiler dark → amber → vintage et enregistre le choix dans `localStorage.smeterTheme`. Il est relu à chaque chargement de page : le choix du visiteur survit donc indéfiniment aux rafraîchissements et aux redémarrages du navigateur. Ce n'est délibérément **pas** un cookie : un cookie serait envoyé au serveur à chaque requête de cascade et d'audio, pour une valeur que le serveur ne lit jamais.

**Côté sysop.** Deux éléments de `SMeterAnalog.svelte` déterminent ce que reçoivent tous les autres :

| Ligne | Rôle |
|-------|------|
| `let smeterTheme = 'dark';` | Le cadran que reçoit un navigateur **sans choix enregistré**. |
| `const SMETER_PREF_VERSION = 2;` | Un compteur. Lorsque la version stockée d'un navigateur est en retard, celui-ci oublie **une seule fois** son cadran enregistré et adopte la valeur par défaut ci-dessus. Incrémentez-le pour déplacer les visiteurs ayant déjà choisi. |

Modifier la seule valeur par défaut ne touche donc que les visiteurs entièrement nouveaux. Les deux modifications ensemble déplacent tout le monde — c'est à cela que sert `smeter_theme.sh` à la racine du dépôt :

```bash
./smeter_theme.sh                 # afficher la valeur actuelle, puis choisir dans un menu
./smeter_theme.sh vintage         # la définir aussitôt, puis proposer la reconstruction
./smeter_theme.sh dark --build    # lancer frontend/build-all.sh sans demander
./smeter_theme.sh amber --no-reset  # nouveaux visiteurs seulement — ne pas toucher aux autres
```

Il affiche la valeur par défaut actuelle, définit la nouvelle, incrémente le compteur de réinitialisation (toujours vers le haut — **ne le baissez jamais**, un nombre plus petit empêche simplement la réinitialisation de se déclencher), puis propose le même choix de construction du frontend que `recompile.sh`. Il ne touche **pas** au backend et ne réécrit **pas** `variant.json`.

> Un changement n'atteint un auditeur connecté qu'au rechargement de sa page : la valeur par défaut est compilée dans le bundle JS et la réinitialisation s'exécute au chargement. Il n'y a pas de diffusion en direct. Un rechargement ordinaire suffit, puisque vite hache les noms de fichiers du bundle.

L'effacement unique du compteur s'impose à tout le monde, y compris aux visiteurs ayant délibérément cliqué pour choisir leur cadran. C'est voulu : c'est le seul moyen de ramener tout le site à une apparence unique. Utilisez `--no-reset` si vous préférez les laisser tranquilles.


### `frontend/src/lib/SMeterDigital.svelte` — 184 lignes

L'instrument à barre segmentée, complet.

- Props d'entrée : `rawDb` — la valeur BRUTE de `audio.getPowerDb()`
- `smeterOffset` — `audio.smeter_offset`
- `mobile` — attributs de canvas réduits

> **REMARQUE :** cet instrument est délibérément alimenté par la puissance BRUTE plus l'offset, PAS par la valeur dBm calibrée qu'utilise le cadran analogique. Il a toujours eu sa propre correspondance. Lui fournir la valeur calibrée décalerait toutes les lectures sur chaque station numérique. Ne cherchez pas à « unifier » ces deux entrées.

### `frontend/src/lib/BandSelector.svelte` — 69 lignes

La grille des boutons de bande. Rendue deux fois dans `App.svelte` (une fois par disposition).

### `frontend/src/lib/ModesSelector.svelte` — 75 lignes

La grille des boutons de mode. Rendue deux fois dans `App.svelte`.

### `frontend/src/lib/StatusIndicators.svelte` — 122 lignes

Les voyants d'état (mute, squelch, NR, NB, NS, AN, CTCSS). Prend une prop `wide` : la disposition numérique utilise des voyants plus larges que l'analogique. Les deux classes Tailwind (`w-8` et `w-10`) sont écrites intégralement dans le composant — le scanner de Tailwind ne voit que des noms de classe littéraux, ne les construisez donc jamais par concaténation de chaînes.

Tous les autres fichiers de `frontend/src/lib/` (Spectrogram, PassbandTuner, FrequencyInput, VersionSelector, ...) sont antérieurs à ce travail et sont inchangés.

---

## 3. Faire une modification qui ne concerne que certaines variantes

Encadrez-la par le drapeau. Dans le balisage :

```svelte
{#if isAnalog}
  ...seules les stations analogiques voient ceci...
{:else}
  ...seules les stations numériques voient ceci...
{/if}

{#if isV2} ... {/if}          {#if !isV2} ... {/if}
```

Dans un attribut class :

```svelte
class="p-4 {isAnalog ? 'text-xs' : 'text-sm'} rounded-md"
```

Écrivez les deux alternatives sous forme de littéraux complets, comme ci-dessus. Tailwind parcourt les sources à la recherche de noms de classe complets ; `text-{size}` ou un nom concaténé est purgé du CSS et le style disparaît silencieusement.

Dans le bloc `<script>` : essayez de NE PAS brancher du tout. Le script calcule délibérément les entrées des DEUX instruments à chaque cycle —

```js
smeterDbm    = powerDb;                    // cadran analogique
smeterRawDb  = audio.getPowerDb();         // cadran numérique
smeterOffset = audio.smeter_offset;        // cadran numérique
```

— si bien que seul le balisage doit choisir. C'est pourquoi il n'y a que 15 aiguillages de variante dans un fichier de 17000 lignes. Gardez-le ainsi ; c'est le branchement au niveau du script qui a fait diverger les quatre anciens fichiers.

---

## 4. Où se trouvent les aiguillages de variante

Quinze endroits dans `App.svelte`. Les numéros de ligne bougent quand vous modifiez — la façon fiable de tous les retrouver est :

```bash
cd frontend/src && grep -n 'isAnalog\|isV2' App.svelte
```

Au moment de la rédaction :

| Ligne | Drapeau | Ce qui est commuté |
|-------|---------|--------------------|
| 20 | | `isAnalog` déclaré |
| 21 | | `isV2` déclaré |
| 8062 | `isV2` | bureau : sélecteur de bande en premier (ordre v2) |
| 8090 | `isV2` | bureau : taille du titre du panneau |
| 8686 | `isV2` | bureau : sélecteur de modes en premier (ordre v1) |
| 8717 | `isAnalog` | largeur minimale du panneau de l'instrument (l'aiguille est plus étroite) |
| 8730 | `isAnalog` | analogique uniquement : ligne date/heure au-dessus de l'instrument |
| 8819 | `isAnalog` | analogique uniquement : voyants d'état + séparateur |
| 8834 | `isAnalog` | numérique uniquement : ligne d'heure, voyants larges, et le choix `<SMeterDigital>` / `<SMeterAnalog>` lui-même |
| 8861 | `isAnalog` | espacement vertical du bloc de fréquence |
| 8864 | `isAnalog` | marge supérieure du bloc d'accord fin |
| 12288 | `isV2` | téléphone : rangée d'accord fin au-dessus (ordre v2) |
| 12347 | `isAnalog` | téléphone : quel instrument afficher |
| 12433 | `isV2` | téléphone : rangée d'accord fin en dessous (ordre v1) |
| 13204 | `isAnalog` | taille du texte du bouton noise gate |

Tout le reste du fichier est commun aux quatre variantes.

---

## 5. Autres réglages à connaître

| Emplacement | Constante | Rôle |
|-------------|-----------|------|
| `App.svelte` ligne 5034 | `const visualGain = 1.1;` | Étalonnage de l'instrument analogique. Chaque tranche de 0,10 vaut environ 5 dBm sur la lecture. |
| `SMeterAnalog.svelte` ligne 55 | `const SMOOTH_TIME_MS = 16;` | Constante de temps du lissage de l'aiguille, en millisecondes. |
| `SMeterAnalog.svelte` ligne 64 | `let smeterTheme = 'dark';` | Cadran par défaut de l'instrument analogique pour un navigateur sans choix enregistré. À définir avec `./smeter_theme.sh`, pas à la main. |
| `SMeterAnalog.svelte` ligne 69 | `const SMETER_PREF_VERSION = 2;` | Compteur de réinitialisation unique du cadran enregistré. À incrémenter pour amener les visiteurs existants sur la valeur par défaut ; il ne fait que monter. |
| `SMeterDigital.svelte` ligne 149 | `const DIGITAL_BAR_TRIM = 0;` | Décale la barre par segments entiers. |
| `SMeterDigital.svelte` ligne 31 | `const numberOfDots = 35;` | Nombre de segments de la barre. |

---

## 6. Après modification — reconstruire

Le plus simple, depuis la racine du dépôt :

```bash
./recompile.sh
```

L'entrée de menu **[2]** reconstruit le frontend et demande quelle variante doit voir un visiteur qui arrive pour la première fois. Ce choix est consigné dans `frontend/variant.json` — aucun fichier source n'est copié ni réécrit. (Elle régénérait aussi `VersionSelector.svelte` à partir d'un heredoc ; cela a été supprimé lorsque le sélecteur a cessé de naviguer, car cela aurait annulé la commutation à l'exécution à chaque passage.) L'entrée **[1]** ne concerne que le backend, la **[3]** les deux.

Ou directement, depuis `frontend/` :

```
./build-all.sh          construit la page bureau ET /mobile/  <-- à utiliser normalement
./build-default.sh      seulement la page bureau
./build-mobile.sh       seulement /mobile/
```

> `build-default.sh` laisse vite vider `dist/`, ce qui supprime `dist/mobile/` jusqu'au prochain `build-all.sh` ou `build-mobile.sh`. C'est pourquoi `build-all.sh` est le choix normal.

`build-all.sh` possède sa propre copie de la logique de construction (`build_version SMETER LAYOUT NAME OUTDIR BASE LOG`) plutôt que d'appeler `build-default.sh`. Si vous changez la façon dont la page est construite, changez-la aux DEUX endroits, sinon les deux chemins divergeront.

Quelques points à connaître :

- Il pose `PHANTOM_KEEP_OUTDIR=1` pour que Vite ne vide pas le répertoire de sortie, et nettoie `dist/` lui-même : il en supprime le contenu mais conserve `users.json`, que le `spectrumserver` en fonctionnement réécrit à chaque connexion et déconnexion d'auditeur.
- Il construit `/mobile` en dernier, une fois la sortie bureau terminée.
- Sa mécanique de construction parallèle (`PHANTOM_BUILD_JOBS`, 3 par défaut) est un vestige de l'époque où il y avait cinq constructions bureau. Avec une seule, rien ne fait la queue.

**Bits d'exécution :** `recompile.sh` exécute `chmod +x` sur un script avant de le lancer, et `build-all.sh` invoque délibérément `bash build-mobile.sh` plutôt que `./build-mobile.sh` : un bit manquant ne casse donc plus la construction. Téléverser un script via l'interface web de GitHub le remet toutefois à 644, donc si vous en lancez un directement :

```bash
chmod +x frontend/build-*.sh
```

---

## 7. Comment vérifier votre modification avant de lui faire confiance

Un `vite build` au vert **NE SUFFIT PAS**. La construction ne peut pas voir un identifiant disparu lors du déplacement de code entre fichiers — c'est une `ReferenceError` à l'exécution, et la page ne se charge tout simplement pas. C'est arrivé deux fois.

### 1) Contrôle des identifiants non définis (attrape exactement cette panne)

```bash
cd frontend
npx eslint --no-eslintrc \
    --parser svelte-eslint-parser \
    --rule '{"no-undef":"error"}' \
    --env browser,es2022 \
    src/App.svelte src/lib/SMeter*.svelte
```

Un signalement connu et bénin est attendu :

```
'dBmCalOffset' is not defined
```

`typeof x === 'number'` sur un nom non déclaré ne lève jamais d'erreur : cette expression vaut déjà 0. Tout le reste est un vrai problème.

### 2) Construisez, puis CHARGEZ LA PAGE ET PARCOUREZ LES QUATRE VARIANTES

Pas seulement celle que vous avez modifiée — une modification sous `isAnalog`/`isV2` peut casser les trois autres alors que la vôtre fonctionne. Ouvrez `/`, parcourez les quatre entrées du menu ⚙️, puis ouvrez `/mobile/`.

Ouvrez la console du navigateur sur chacune. Une page blanche ou à moitié dessinée avec une `ReferenceError` dans la console est la signature du bogue ci-dessus.

### 3) Ne laissez jamais `frontend/dist/` dans un état partiel

Un simple `npx vite build` vide le répertoire de sortie et emporte avec lui `dist/mobile/` ainsi que le `dist/users.json` vivant du serveur — la page mobile renvoie 404 jusqu'à la prochaine construction réussie. Construisez toujours via les scripts : `build-all.sh` pose `PHANTOM_KEEP_OUTDIR=1` et fait lui-même le nettoyage, en préservant `dist/users.json`. Dans le doute, relancez simplement `./build-all.sh`.
