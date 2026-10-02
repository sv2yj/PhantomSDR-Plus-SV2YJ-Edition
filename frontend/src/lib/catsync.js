// catsync.js
//
// Client de synchro CAT bidirectionnelle pour PhantomSDR (rig <-> Phantom),
// via le serveur TCI natif d'AetherSDR (ou ExpertSDR2/3, SunSDR, Thetis...),
// qui parle un protocole texte à trames terminées par ';' :
//   vfo:0,0,14074000;
//   modulation:0,usb;
//   trx:0,true;
// Aucun pont local n'est nécessaire : le navigateur se connecte directement
// au port TCI de l'appli.
//
// (Le pont Hamlib/rigctld pour rig CAT série classique, utilisé un temps en
// parallèle, a été retiré : seul le chemin TCI est conservé.)

const DEFAULT_CONFIG = {
  host: "localhost",
  port: 50001, // port par défaut du serveur TCI d'AetherSDR/ExpertSDR3
  reconnectDelayMs: 3000,
};

const STORAGE_KEY = "phantom.catsync";

export function loadCatSyncConfig() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    return saved && typeof saved === "object"
      ? { ...DEFAULT_CONFIG, ...saved }
      : { ...DEFAULT_CONFIG };
  } catch (e) {
    return { ...DEFAULT_CONFIG };
  }
}

export function saveCatSyncConfig(config) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch (e) {
    // Stockage indisponible (navigation privée) -- la session en cours
    // fonctionne quand même, seule la persistance est perdue.
  }
}

// Une trame TCI peut contenir plusieurs commandes ';'-terminées d'un coup
// (c'est le cas de la rafale d'initialisation à la connexion).
function parseTciFrame(text, state) {
  const frames = text
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);

  for (const frame of frames) {
    const sep = frame.indexOf(":");
    if (sep === -1) continue;
    const cmd = frame.slice(0, sep);
    const args = frame
      .slice(sep + 1)
      .split(",")
      .map((s) => s.trim());

    switch (cmd) {
      case "vfo":
        // vfo:<trx>,<channel>,<freq_hz>
        if (args.length >= 3) {
          const hz = parseInt(args[2], 10);
          if (Number.isFinite(hz)) state.freq_hz = hz;
        }
        break;
      case "modulation":
        // modulation:<trx>,<mode>
        if (args.length >= 2) state.mode = args[1].toUpperCase();
        break;
      case "trx":
        // trx:<trx>,<true|false>
        if (args.length >= 2) state.ptt = args[1] === "true";
        break;
      case "rx_filter_band":
        // rx_filter_band:<trx>,<bas_hz>,<haut_hz> (par rapport à la porteuse)
        if (args.length >= 3) {
          const low = parseInt(args[1], 10);
          const high = parseInt(args[2], 10);
          if (Number.isFinite(low) && Number.isFinite(high)) {
            state.filter_low = low;
            state.filter_high = high;
          }
        }
        break;
      // Les autres commandes TCI (drive, agc_mode, sql_enable...) ne nous
      // concernent pas ici -- on ignore silencieusement.
    }
  }
  return state;
}

/**
 * Ouvre la connexion TCI configurée et notifie les changements via les
 * callbacks fournis. Reconnexion automatique si le serveur TCI n'est pas
 * encore lancé ou se coupe (pas d'erreur bloquante : l'auditeur sans CAT
 * configuré ne voit jamais rien).
 *
 * @param {object} config          voir DEFAULT_CONFIG
 * @param {object} callbacks
 * @param {(isTx: boolean) => void} callbacks.onPtt
 * @param {(freqHz: number, mode: string) => void} callbacks.onVfo
 * @param {(state: "connecté"|"déconnecté"|"erreur", detail?: string, config?: object) => void} [callbacks.onStatus]
 * @returns {{ close: () => void }}
 */
export function connectCatSync(config, { onPtt, onVfo, onFilter, onStatus }) {
  let ws = null;
  let closed = false;
  let reconnectTimer = null;
  const lastState = {
    freq_hz: null,
    mode: null,
    ptt: null,
    filter_low: null,
    filter_high: null,
  };

  function emit(partial) {
    if (partial.ptt !== undefined && partial.ptt !== lastState.ptt) {
      lastState.ptt = partial.ptt;
      onPtt && onPtt(partial.ptt);
    }
    const freqChanged =
      partial.freq_hz !== undefined && partial.freq_hz !== lastState.freq_hz;
    const modeChanged =
      partial.mode !== undefined && partial.mode !== lastState.mode;
    if (freqChanged) lastState.freq_hz = partial.freq_hz;
    if (modeChanged) lastState.mode = partial.mode;
    if (freqChanged || modeChanged) {
      onVfo && onVfo(lastState.freq_hz, lastState.mode);
    }
    // Le filtre après le mode : un changement de mode remet la bande
    // passante de la page à sa valeur par défaut, puis le filtre du rig
    // s'applique par-dessus. Renvoyé aussi quand seul le mode a changé.
    if (
      partial.filter_low !== undefined &&
      (partial.filter_low !== lastState.filter_low ||
        partial.filter_high !== lastState.filter_high ||
        modeChanged)
    ) {
      lastState.filter_low = partial.filter_low;
      lastState.filter_high = partial.filter_high;
      onFilter && onFilter(lastState.filter_low, lastState.filter_high);
    }
  }

  function scheduleReconnect() {
    if (closed) return;
    clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(connect, config.reconnectDelayMs || 3000);
  }

  function connect() {
    if (closed) return;
    const url = `ws://${config.host}:${config.port}`;

    try {
      ws = new WebSocket(url);
    } catch (e) {
      onStatus && onStatus("erreur", String(e), config);
      scheduleReconnect();
      return;
    }

    ws.onopen = () => {
      onStatus && onStatus("connecté", url, config);
      // L'état initial n'arrive pas tout seul en TCI tant qu'on n'a rien
      // demandé ; ensuite, chaque changement est poussé sans qu'on ait à
      // re-interroger.
      ws.send("vfo:0;\nmodulation:0;\ntrx:0;\n");
    };

    ws.onmessage = (ev) => {
      try {
        emit(parseTciFrame(ev.data, {}));
      } catch (e) {
        console.warn("catsync: trame illisible", ev.data, e);
      }
    };

    ws.onclose = () => {
      onStatus && onStatus("déconnecté", url, config);
      scheduleReconnect();
    };

    // onerror est systématiquement suivi de onclose pour un WebSocket natif
    // -- la reconnexion est déjà programmée là-bas, pas besoin de dupliquer.
    ws.onerror = () => {};
  }

  connect();

  return {
    close() {
      closed = true;
      clearTimeout(reconnectTimer);
      if (ws) ws.close();
    },
    // Règle la fréquence sur le rig, en trame TCI. Sans effet (retourne
    // false) si cette connexion n'est pas ouverte.
    sendSetFreq(freqHz) {
      if (!ws || ws.readyState !== WebSocket.OPEN) return false;
      const hz = Math.round(freqHz);
      ws.send(`vfo:0,0,${hz};`);
      return true;
    },
    // Règle le mode sur le rig (nom TCI : usb, lsb, cw, am, nfm, wfm...).
    // Sans effet (retourne false) si cette connexion n'est pas ouverte.
    sendSetMode(tciMode) {
      if (!ws || ws.readyState !== WebSocket.OPEN) return false;
      ws.send(`modulation:0,${tciMode};`);
      return true;
    },
    // Règle le filtre sur le rig : bords bas et haut en Hz par rapport à la
    // porteuse (négatifs en LSB), comme la commande TCI rx_filter_band.
    sendSetFilter(lowHz, highHz) {
      if (!ws || ws.readyState !== WebSocket.OPEN) return false;
      ws.send(`rx_filter_band:0,${Math.round(lowHz)},${Math.round(highHz)};`);
      return true;
    },
  };
}

// Ports TCI par défaut des logiciels courants -- essayés EN PARALLÈLE (voir
// connectCatSyncAny) pour que l'auditeur n'ait jamais à savoir/configurer
// lequel son propre logiciel utilise :
//   50001 : ExpertSDR3 / AetherSDR
//   40001 : ExpertSDR2 / Thetis (et SunSDR2 sous ancien firmware)
// Seul celui réellement ouvert répondra ; les autres échouent en silence et
// retentent en tâche de fond (voir connectCatSync).
const TCI_CANDIDATE_PORTS = [50001, 40001];

/**
 * Construit la liste des sources TCI à essayer en parallèle sur l'hôte
 * donné (un port par candidat connu -- voir TCI_CANDIDATE_PORTS). Ajouter
 * un nouveau logiciel/port à gérer ne demande qu'à étendre cette liste.
 *
 * @param {string} host  "localhost" si le logiciel TCI tourne sur la même
 *                        machine que le navigateur (cas courant) ; sinon
 *                        son adresse IP locale (ex. "192.168.1.42") si
 *                        elle tourne sur un PC distinct du même réseau.
 */
export function buildDefaultSources(host = "localhost") {
  return TCI_CANDIDATE_PORTS.map((port) => ({
    host,
    port,
    reconnectDelayMs: 5000,
  }));
}

// Conservé pour compatibilité : équivaut à buildDefaultSources("localhost").
export const DEFAULT_SOURCES = buildDefaultSources("localhost");

/**
 * Ouvre une ou plusieurs sources CAT en parallèle (voir connectCatSync pour
 * le détail d'une source) et relaie les événements de celle(s) qui
 * répond(ent) réellement -- l'appelant n'a pas à s'en soucier.
 *
 * @param {object[]} configs
 * @param {object} callbacks               mêmes callbacks que connectCatSync
 * @returns {{ close: () => void, sendFreqToRig: (freqHz: number) => boolean }}
 */
export function connectCatSyncAny(configs, callbacks) {
  const handles = configs.map((cfg) => connectCatSync(cfg, callbacks));
  return {
    close() {
      handles.forEach((h) => h.close());
    },
    // Voie retour Phantom -> rig : envoyée sur toutes les sources
    // configurées. En pratique une seule est réellement connectée à la
    // fois -- les autres no-opent silencieusement (ws fermée). Sans effet
    // si aucune source n'est connectée, ou si l'appelant n'appelle
    // simplement pas cette fonction (bouton "CAT Sync" désactivé côté
    // App.svelte).
    sendFreqToRig(freqHz) {
      let sent = false;
      handles.forEach((h) => {
        if (h.sendSetFreq(freqHz)) sent = true;
      });
      return sent;
    },
    // Même principe pour le mode.
    sendModeToRig(tciMode) {
      let sent = false;
      handles.forEach((h) => {
        if (h.sendSetMode(tciMode)) sent = true;
      });
      return sent;
    },
    // Et pour le filtre.
    sendFilterToRig(lowHz, highHz) {
      let sent = false;
      handles.forEach((h) => {
        if (h.sendSetFilter(lowHz, highHz)) sent = true;
      });
      return sent;
    },
  };
}
