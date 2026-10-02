# Guide d'installation de System Stats

Un guide complet pour ajouter une surveillance de serveur en temps réel à votre application PhantomSDR à l'aide du script d'installation automatisé.

## Aperçu

Cette fonctionnalité ajoute un bouton **📊 Stats** à votre interface PhantomSDR qui affiche des informations système en temps réel :
- Utilisation du CPU, cœurs, fréquence, température et principaux processus
- Utilisation de la mémoire (utilisée/totale/pourcentage)

Les statistiques se mettent à jour automatiquement toutes les 5 secondes tant que la fenêtre modale est ouverte.

> **À ne pas confondre avec la page « Graphiques » du panneau d'administration.** Cette fenêtre est un instantané qui se rafraîchit tant qu'elle est ouverte et ne conserve aucun historique. Le panneau d'administration dispose d'une page **Graphiques** distincte qui échantillonne la fréquence du processeur, la charge, la température et les utilisateurs connectés toutes les 2 secondes et les trace sur les 15 dernières minutes à 24 heures — voir le [guide du panneau d'administration](../fr/ADMIN_PANEL_SETUP.md).

---

## Prérequis

- **Serveur Linux** (Ubuntu/Debian recommandé)
- **Connexion Internet** (pour télécharger Node.js et les paquets)
- **Accès Sudo** (pour la configuration du service systemd)
- **PhantomSDR-Plus** déjà installé et en cours d'exécution
- **lm-sensors** (recommandé pour la température CPU Intel/AMD - installé automatiquement par le script)

---

## Méthodes d'installation

> [!NOTE]
> **L'installateur principal le propose déjà.** `./install.sh` — et les quatre installateurs par distribution — exécutent `install-stats-server.sh` par défaut pendant l'installation normale de PhantomSDR-Plus : sur une machine neuve, le serveur de statistiques est donc généralement déjà en place. Utilisez cette page pour l'installer séparément, ou pour changer ensuite son port, son adresse ou son service.

### Option 1 : Installation automatisée (Recommandée) ⭐

Le script automatisé s'occupe de tout pour vous.

#### Étape 1 : Exécuter le script

```bash
cd ~/PhantomSDR-Plus
chmod +x install-stats-server.sh   # only if it is not already executable
./install-stats-server.sh
```

**IMPORTANT :** N'exécutez PAS en tant que root ou avec sudo. Exécutez en tant qu'utilisateur normal.

#### Étape 2 : Suivre les invites interactives

Le script vous guidera à travers :

##### 1. **Installation de Node.js** (si nécessaire)
```
⚠ Node.js / npm is not installed
Would you like to install Node.js 22 via nvm now? (y/n): y
```
Le script installe Node.js 22 via nvm, sur toute distribution Linux — sans root et sans source apt. Il pose la même question lorsque Node.js est présent mais antérieur à la version 22.

##### 2. **Répertoire d'installation**
```
Installation directory [/home/user/sdr-stats-server]: 
```
Appuyez sur Entrée pour la valeur par défaut, ou spécifiez un chemin personnalisé.

##### 3. **Configuration du port** (Améliorée !)
```
Port Configuration:
  Default port: 3001
  Common alternatives: 8080, 5000, 8888
Enter port number [3001]: 
```

Le script valide votre port :
- ✅ Vérifie qu'il s'agit d'un nombre valide
- ✅ Avertit si le port < 1024 (nécessite des privilèges root)
- ✅ Valide la plage (1-65535)
- ✅ Vérifie si le port est déjà utilisé
- ✅ Indique quel processus l'utilise s'il est occupé
- ✅ Vous permet de choisir un port différent

**Exemples de scénarios :**

**Utilisation du port par défaut :**
```
Enter port number [3001]: ↵
✓ Port 3001 selected
```

**Choix d'un port personnalisé :**
```
Enter port number [3001]: 8080
✓ Port 8080 selected
```

**Port déjà utilisé :**
```
Enter port number [3001]: 3001
⚠ Port 3001 is currently in use
Process using port 3001:
node    12345 user   20u  IPv6 123456  TCP *:3001 (LISTEN)
Choose a different port? (y/n): y
Enter port number [3001]: 3002
✓ Port 3002 selected
```

**Port invalide :**
```
Enter port number [3001]: abc
✗ Port must be a number
Enter port number [3001]: 99999
✗ Port must be between 1 and 65535
Enter port number [3001]: 3001
✓ Port 3001 selected
```

##### 4. **Adresse du serveur**
```
What is your server's public address?
Examples: Your_site_IP, 192.168.1.100, localhost
Server address: Your_site_IP
```
Entrez le domaine public ou l'adresse IP de votre serveur.

##### 5. **Confirmation**
```
Please confirm your settings:
  Installation directory: /home/user/sdr-stats-server
  Port: 3001
  Server address: Your_site_IP
  Stats URL will be: http://Your_site_IP:3001
Continue with these settings? (y/n): y
```

##### 6. **Configuration du service Systemd** (Optionnel)
```
Would you like to set up the server as a system service (auto-start on boot)? (y/n): y
```

Recommandé : Choisissez **y** pour que le serveur démarre automatiquement au démarrage.

#### Étape 3 : Installation terminée ! ✓

Le script affichera un résumé :
```
╔════════════════════════════════════════════════╗
║          Installation Complete! ✓              ║
║          Open the port in the router!          ║
╚════════════════════════════════════════════════╝

Configuration Summary:
  Installation: /home/user/sdr-stats-server
  Port: 3001
  Server: Your_site_IP
  API URL: http://Your_site_IP:3001/api/system-stats
```

---

## Configurer votre application PhantomSDR

Une fois le script terminé, vous devez mettre à jour votre application Svelte.

### Étape 1 : Mettre à jour `site_information.json`

Comme `site_information.json` a déjà été modifié lors de la configuration initiale, il vous suffit d'ajouter la nouvelle ligne `siteStats` avec votre port :

```json
{
	"siteSysop": "your name or callsign",
	"siteSysopEmailAddress": "mail@mail.net",
	"siteGridSquare": "QTH locator",
	"siteCity": "City Country",
	"siteInformation": "https://github.com/sv1btl/PhantomSDR-Plus",
	"siteHardware": "Hardware you are using, ",
	"siteSoftware": "Software you are using",
	"siteReceiver": "Receiver model",
	"siteAntenna": "Receiving Antenna.",
	"siteNote": "This is a bright new open-source WebSDR project, under active development.",
	"siteIP": "http://Your_site_IP:port",
  "siteStats": "http://Your_site_IP:3001",  ← AJOUTEZ CETTE LIGNE (utilisez votre port)
  "siteSDRBaseFrequency": 0,
  "siteSDRBandwidth": 30000000,
  "siteRegion": 1,
  "siteChatEnabled": true
}
```

**Note :** Utilisez le port que vous avez sélectionné pendant l'installation !

### Étape 2 : Mettre à jour `App.svelte` (la dernière version GitHub inclut déjà le fichier mis à jour)

Effectuez ces **4 modifications** dans votre fichier App.svelte :

#### Modification 1 : S'assurer que `siteStats` est déclaré (vers la ligne 50)

```javascript
import {
  siteSysop,
  siteSysopEmailAddress,
  siteInformation,
  siteGridSquare,
  siteCity,
  siteHardware,
  siteSoftware,
  siteReceiver,
  siteAntenna,
  siteNote,
  siteIP,
  siteStats,  // ← AJOUTEZ CETTE LIGNE
  siteSDRBaseFrequency,
  siteSDRBandwidth,
  siteRegion,
  siteChatEnabled,
} from "../site_information.json";
```

#### Modification 2 : Mettre à jour l'objet systemStats (vers la ligne 530)

```javascript
let systemStats = {
  cpu: { usage: 0, cores: 0, temperature: null, frequency: null, topProcesses: [] },  // ← AJOUTEZ topProcesses: []
  memory: { used: 0, total: 0, percent: 0 }
};
```

#### Modification 3 : Mettre à jour l'URL de récupération (vers la ligne 541)

```javascript
async function fetchSystemStats() {
  try {
    const response = await fetch(`${siteStats}/api/system-stats`);  // ← MODIFIEZ CETTE LIGNE
    if (response.ok) {
      systemStats = await response.json();
    } else {
      console.error('Failed to fetch system stats:', response.statusText);
    }
  } catch (error) {
    console.error('Error fetching system stats:', error);
  }
}
```

#### Modification 4 : Ajouter l'affichage des principaux processus (dans la section CPU, vers la ligne 3838)

Ajoutez ce code après la section température :

```svelte
{#if systemStats.cpu.frequency}
<div style="display: flex; justify-content: space-between; margin-bottom: 0.25rem;">
  <span>Frequency:</span>
  <span style="color: #4ade80;">{systemStats.cpu.frequency.current} GHz{#if systemStats.cpu.frequency.max} <span style="opacity: 0.7;">(max {systemStats.cpu.frequency.max})</span>{/if}</span>
</div>
{/if}

{#if systemStats.cpu.temperature !== null}
<div style="display: flex; justify-content: space-between; margin-bottom: 0.25rem;">
  <span>Temperature:</span>
  <span style="color: {systemStats.cpu.temperature > 70 ? '#fbbf24' : '#4ade80'};">{systemStats.cpu.temperature}°C</span>
</div>
{/if}

<!-- AJOUTEZ TOUTE CETTE SECTION : -->
{#if systemStats.cpu.topProcesses && systemStats.cpu.topProcesses.length > 0}
<div style="margin-top: 0.75rem; padding-top: 0.75rem; border-top: 1px solid rgba(255,255,255,0.1);">
  <h4 style="margin: 0 0 0.5rem 0; font-size: 0.85rem; color: rgba(0, 225, 255, 0.8);">Top Processes:</h4>
  {#each systemStats.cpu.topProcesses as process}
  <div style="display: flex; justify-content: space-between; margin-bottom: 0.25rem; font-size: 0.85rem;">
    <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 70%;">{process.name}</span>
    <span style="color: {process.cpu > 50 ? '#ef4444' : process.cpu > 25 ? '#fbbf24' : '#4ade80'};">{process.cpu}%</span>
  </div>
  {/each}
</div>
{/if}
```

### Étape 3 : Recompiler votre application

```bash
cd /path/to/your/phantomsdr-app
npm ./recompile.sh
```

---

## Tester l'installation

### Test 1 : Vérifier le point de terminaison de l'API

```bash
curl http://localhost:3001/api/system-stats
```

Sortie attendue (JSON) :
```json
{
  "cpu": {
    "usage": 45.2,
    "cores": 8,
    "coresUsed": 1.3,
    "temperature": 62.5,
    "frequency": {
      "current": 3.0,
      "max": 3.9,
      "limit": 4.4
    },
    "topProcesses": [
      {"name": "node", "cpu": 12.5},
      {"name": "phantomsdr", "cpu": 8.3}
    ]
  },
  "memory": {
    "used": 8.5,
    "total": 16,
    "percent": 53
  }
}
```

### Test 2 : Vérifier l'état du service

Si vous l'avez installé en tant que service :

```bash
sudo systemctl status sdr-stats.service
```

Devrait afficher : `Active: active (running)`

### Test 3 : Tester dans le navigateur

1. Ouvrez votre interface web PhantomSDR
2. Faites défiler jusqu'à la section **Additional Info**
3. Cliquez sur le bouton **Open Additional Info**
4. Recherchez le bouton **📊 Stats** à côté des infos PC
5. Cliquez dessus pour ouvrir la fenêtre modale des statistiques
6. Vérifiez que les statistiques s'affichent et se mettent à jour

---

## Gestion du service

Si vous l'avez installé en tant que service systemd, utilisez ces commandes :

```bash
# Start the service
sudo systemctl start sdr-stats.service

# Stop the service
sudo systemctl stop sdr-stats.service

# Restart the service (after updating files)
sudo systemctl restart sdr-stats.service

# Check status
sudo systemctl status sdr-stats.service

# View real-time logs
sudo journalctl -u sdr-stats.service -f

# View last 50 log entries
sudo journalctl -u sdr-stats.service -n 50

# Enable auto-start on boot
sudo systemctl enable sdr-stats.service

# Disable auto-start
sudo systemctl disable sdr-stats.service

# Edit service
sudo nano /etc/systemd/system/sdr-stats.service

# Delete service
sudo rm /etc/systemd/system/sdr-stats.service
```

---

## Installation manuelle (Option 2)


> [!IMPORTANT]
> **Vous n'avez pas besoin de cette section pour une installation normale.** `install-stats-server.sh` fait tout cela pour vous et l'installateur principal le lance par défaut. Ne la suivez que pour une installation manuelle ou pour réparer un élément à la main.

**⚠️ Avertissement :** L'installation manuelle peut utiliser des fichiers obsolètes. Le **script automatisé est fortement recommandé** car il :
- Installe la dernière version avec une détection de température améliorée
- Installe et configure automatiquement lm-sensors
- Gère automatiquement toutes les dépendances

Si vous préférez tout de même l'installation manuelle :

### 1. Installer Node.js
```bash
# Any distribution - nvm needs no root and no apt source.
# NOT NodeSource: deb.nodesource.com now answers HTTP 403 on every path.
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.4/install.sh | bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
nvm install 22 && nvm use 22 && nvm alias default 22
```

### 2. Installer lm-sensors (Requis pour la température Intel/AMD)
```bash
sudo apt-get update
sudo apt-get install -y lm-sensors
sudo sensors-detect --auto
```

### 3. Créer le répertoire
```bash
mkdir ~/sdr-stats-server
cd ~/sdr-stats-server
```

### 4. Télécharger les derniers fichiers

**Important :** les fichiers du serveur ne sont plus conservés en copie dans le dépôt - c'est le script d'installation qui les génère.

À la place, exécutez le script automatisé une fois pour générer les derniers fichiers, puis copiez-les :
```bash
# Run the automated script from the repository root
cd ~/PhantomSDR-Plus
./install-stats-server.sh
# When prompted, use a temporary port like 9999
# After installation completes, copy the generated files
cp ~/sdr-stats-server/system-stats-server.js ~/your-manual-install-dir/
cp ~/sdr-stats-server/package.json ~/your-manual-install-dir/
```

**OU** créez manuellement les fichiers en utilisant le code le plus récent du script d'installation.

### 5. Modifier le port (si nécessaire)
```bash
nano ~/sdr-stats-server/system-stats-server.js
```

Modifiez la ligne 6 :
```javascript
const PORT = process.env.PORT || 3001;  // Change this number
```

### 6. Installer les dépendances
```bash
npm install
```

### 7. Test d'exécution
```bash
npm start
```

### 8. Configurer le service (Optionnel)

Suivez la configuration du service systemd de la section d'installation automatisée.

## Changer le port après l'installation

Si vous devez changer le port après l'installation :

### Étape 1 : Modifier le fichier du serveur

```bash
nano ~/sdr-stats-server/system-stats-server.js
```

Modifiez la ligne 6 :
```javascript
const PORT = process.env.PORT || 3001;  // Change this number
```

### Étape 2 : Mettre à jour site_information.json

```json
"siteStats": "http://Your_site_IP:NEW_PORT"
```

### Étape 3 : Redémarrer le service

```bash
sudo systemctl restart sdr-stats.service
```

### Étape 4 : Recompiler votre application Svelte

```bash
cd /path/to/phantomsdr-app
npm run build
```

---

## Dépannage

### Problème : Port déjà utilisé

**Erreur :**
```
Error: listen EADDRINUSE: address already in use :::3001
```

**Solution :**

1. Trouvez ce qui utilise le port :
```bash
sudo lsof -i :3001
```

2. Arrêtez ce processus :
```bash
kill <PID>
# or
sudo systemctl stop sdr-stats.service
```

3. Redémarrez le service :
```bash
sudo systemctl start sdr-stats.service
```

**Alternative :** Exécutez à nouveau le script d'installation et choisissez un port différent lorsque cela vous est demandé.

### Problème : Le service ne démarre pas

**Erreur :**
```
status=217/USER
```

**Solution :**

1. Vérifiez le fichier de service :
```bash
cat /etc/systemd/system/sdr-stats.service
```

2. Vérifiez que la ligne `User=` correspond à votre nom d'utilisateur :
```bash
whoami
```

3. Modifiez si nécessaire :
```bash
sudo nano /etc/systemd/system/sdr-stats.service
```

4. Rechargez et redémarrez :
```bash
sudo systemctl daemon-reload
sudo systemctl restart sdr-stats.service
```

### Problème : Les statistiques ne s'affichent pas dans le navigateur

**Symptômes :** La fenêtre modale s'ouvre mais pas de données, ou affiche des valeurs à 0

**Solutions :**

1. Vérifiez la console du navigateur (F12) pour les erreurs
2. Vérifiez que l'API est accessible :
```bash
curl http://localhost:3001/api/system-stats
```
3. Vérifiez que le service est en cours d'exécution :
```bash
sudo systemctl status sdr-stats.service
```
4. Vérifiez que `siteStats` dans `site_information.json` correspond à l'adresse et au port de votre serveur
5. Vérifiez les erreurs CORS - assurez-vous que le serveur autorise votre domaine

### Problème : La température affiche null

**Cause :** Lecture de température non disponible sur votre système

**Solutions :**

1. **Pour la plupart des systèmes Linux :** Vérifiez si la zone thermique existe :
```bash
cat /sys/class/thermal/thermal_zone0/temp
```

2. **Installez lm-sensors :**
```bash
sudo apt-get install lm-sensors
sudo sensors-detect
sensors
```

3. **Note :** La température peut ne pas être disponible sur :
- Les machines virtuelles
- Certains fournisseurs VPS
- Windows Subsystem for Linux (WSL)
- Les systèmes non-Linux

C'est normal - le reste des statistiques fonctionnera quand même !

### Problème : Les valeurs des statistiques ne correspondent pas à `top`

**Cause :** La période d'échantillonnage du CPU était trop courte dans les versions antérieures

**Solution :** La version actuelle utilise un échantillonnage d'une seconde pour des lectures précises. Si vous avez une ancienne installation :

1. Mettez à jour le fichier du serveur :
```bash
nano ~/sdr-stats-server/system-stats-server.js
```

2. Trouvez la ligne 18 et modifiez :
```javascript
}, 100);  // Old value
```
en :
```javascript
}, 1000);  // New value (1 second)
```

3. Redémarrez :
```bash
sudo systemctl restart sdr-stats.service
```

Ou réexécutez simplement le script d'installation pour obtenir la dernière version.

### Problème : Node.js introuvable

**Erreur :**
```
node: command not found
```

**Solution :**

1. Installez Node.js :
```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.4/install.sh | bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
nvm install 22 && nvm use 22 && nvm alias default 22
```

2. Vérifiez :
```bash
node --version
npm --version
```

---

## Ce que vous verrez

Une fois installé et configuré, la fenêtre modale des statistiques affiche :

### 🖥️ Section CPU
- **Utilisation** : Pourcentage d'utilisation global du CPU
- **Cœurs** : Quelle part du CPU est réellement utilisée, exprimée en cœurs entiers — par exemple `1.3 / 12 in use` signifie que la machine effectue le travail de 1,3 cœur. C'est exact et sans aucun seuil. Ce n'est volontairement pas un décompte de cœurs occupés : l'ordonnanceur répartit le travail d'un cœur sur plusieurs, si bien qu'un tel décompte ne ferait qu'approcher ce chiffre.
- **Fréquence** : Fréquence actuelle moyenne du CPU sur tous les cœurs en GHz, avec le cœur le plus rapide entre parenthèses (si disponible)
- **Température** : Température du CPU en Celsius (si disponible), avec code couleur : 🟢 vert jusqu'à 69 °C, 🟠 orange 70-79 °C, 🔴 rouge à partir de 80 °C
- **Principaux processus** : Les 5 processus les plus gourmands en CPU avec des pourcentages à code couleur :
  - 🟢 Vert : jusqu'à 50 % CPU
  - 🟠 Orange : 51-80 % CPU
  - 🔴 Rouge : au-delà de 80 % CPU

### 💾 Section mémoire
- **Utilisée** : Mémoire en cours d'utilisation (Go)
- **Totale** : Mémoire système totale (Go)
- **Utilisation** : Pourcentage d'utilisation de la mémoire (à code couleur)

### ♻️ Mise à jour automatique
- Les statistiques se rafraîchissent toutes les **5 secondes** tant que la fenêtre modale est ouverte
- La mise à jour s'arrête lorsque vous fermez la fenêtre modale (économise les ressources)

---


## Détection de la température

Le serveur de statistiques utilise une détection de température avancée à méthodes multiples :

### ✅ **Systèmes pris en charge :**
- **Processeurs Intel** : Lit depuis les capteurs coretemp via lm-sensors
- **Processeurs AMD** : Lit depuis les capteurs k10temp (Tdie/Tctl)
- **Processeurs ARM** : Lit depuis les zones thermiques (Raspberry Pi, etc.)

### 📋 **Exigences :**
- **Intel/AMD** : Nécessite le paquet `lm-sensors` (installé automatiquement par le script)
- **ARM/Raspberry Pi** : Fonctionne d'emblée, aucun paquet supplémentaire nécessaire

### 🔧 **Priorité d'installation :**
1. Essaie la commande `sensors` pour la température Package/Core (Intel/AMD)
2. Se rabat sur la lecture directe de coretemp (Intel)
3. Se rabat sur thermal_zone0 (ARM/Raspberry Pi)

Si la température affiche `null`, installez lm-sensors :
```bash
sudo apt-get install lm-sensors
sudo sensors-detect --auto
sudo systemctl restart sdr-stats.service
```

---

## Résumé des fonctionnalités

✅ **Surveillance en temps réel** - Statistiques système en direct depuis votre serveur
✅ **Métriques CPU** - Utilisation, cœurs, température, principaux processus
✅ **Suivi de la mémoire** - Utilisée, totale et pourcentage
✅ **Mises à jour automatiques** - Se rafraîchit toutes les 5 secondes
✅ **Code couleur** - Indicateurs visuels pour les avertissements
✅ **Léger** - Utilisation minimale des ressources
✅ **Installation facile** - Le script automatisé s'occupe de tout
✅ **Validation du port** - Sélection de port intelligente avec détection des conflits
✅ **Gestion du service** - Démarrage automatique au démarrage

---

## Notes de sécurité

- Le serveur de statistiques accepte les connexions de toute origine (CORS : *)
- Pour la production, envisagez de restreindre CORS à votre domaine uniquement
- La sélection du port valide l'entrée et vérifie les conflits
- La lecture de la température du CPU est en lecture seule et sûre
- Aucune information système sensible n'est exposée

---

## Support et ressources

### Fichiers inclus :
Dans ce dossier (le script d'installation lui-même se trouve à la racine, sous `PhantomSDR-Plus/install-stats-server.sh` - il n'en existe qu'une seule copie) :
- `package.json` - Dépendances, identiques à ce qu'écrit le script
- Ce document, également disponible en de, el, es, fr, hr et ru

Créés par le script dans `~/sdr-stats-server/` :
- `system-stats-server.js` - Serveur backend, généré avec le port choisi
- `package.json` - Dépendances
- `node_modules/` - installé par `npm install`

### Obtenir de l'aide :
- Consultez la section de dépannage ci-dessus
- Examinez les journaux du service : `sudo journalctl -u sdr-stats.service -n 50`
- Testez l'API manuellement : `curl http://localhost:3001/api/system-stats`
- Vérifiez les fichiers de configuration

### Désinstaller le serveur de statistiques :
- Supprimez le dossier /sdr-stats-server
- Si vous avez créé un service, supprimez-le simplement en utilisant :
```bash
sudo rm /etc/systemd/system/sdr-stats.service"`
```
- Modifiez `App.svelte` : Trouvez la partie du code :
```
                   <!-- In case you don't want the Stats Button to appear, please comment this button section (12 lines)-->                     
                    <!-- System Stats Button -->
                    <button
                      type="button"
                      class="glass-button text-white py-1 px-2 ml-2 rounded text-xs"
                      on:click={openSystemStats}
                      title="System Resources"
                      aria-haspopup="dialog"
                      aria-expanded={showSystemStats}
                      aria-controls="system-stats-dialog"
                      style="color:rgba(0, 225, 255, 0.993); font-size: 0.75rem;"
                    >
                      📊 Stats
                    </button>
  ```
  et remplacez par :
```
                   <!-- In case you don't want the Stats Button to appear, please comment this button section (12 lines)-->                     
                    <!-- System Stats Button -->
                    <!--
                    <button
                      type="button"
                      class="glass-button text-white py-1 px-2 ml-2 rounded text-xs"
                      on:click={openSystemStats}
                      title="System Resources"
                      aria-haspopup="dialog"
                      aria-expanded={showSystemStats}
                      aria-controls="system-stats-dialog"
                      style="color:rgba(0, 225, 255, 0.993); font-size: 0.75rem;"
                    >
                      📊 Stats
                    </button>
                    -->
  ```                    
- Recompilez à l'aide de la commande :
```bash
  cd PhantomSDR-Plus
 ./recompile.sh
 ```
- Redémarrez le PC et lancez le serveur

---

**Auteur :** Créé pour PhantomSDR-Plus
**Version :** 1.1 (Détection améliorée de la température CPU pour Intel/AMD) **Mis à jour :** Janvier 2026
**Licence :** MIT

---

## Référence rapide des commandes

```bash
# Installation
cd ~/PhantomSDR-Plus
chmod +x install-stats-server.sh
./install-stats-server.sh

# Service Management
sudo systemctl start sdr-stats.service      # Start
sudo systemctl stop sdr-stats.service       # Stop
sudo systemctl restart sdr-stats.service    # Restart
sudo systemctl status sdr-stats.service     # Status
sudo journalctl -u sdr-stats.service -f     # Logs

# Testing
curl http://localhost:3001/api/system-stats # Test API
curl http://localhost:3001/api/health       # Health check

# Troubleshooting
sudo lsof -i :3001                          # Check port
whoami                                      # Check username
node --version                              # Check Node.js
```

Bonne surveillance ! 📊🚀
