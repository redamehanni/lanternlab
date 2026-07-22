/**
 * Event Engine — Registre des types d'événements et des canaux de diffusion.
 *
 * Point d'extension unique (principe Open/Closed), sur le modèle de
 * `walletRegistry.defineKind` et `worldFactory.defineRecipe` : un nouveau
 * producteur d'initiatives locales (association, artiste, citoyen, IA…) déclare
 * ici un `type` d'événement avec son cycle de vie, ses capacités et ses canaux
 * par défaut. Le cœur (`index.js`) ne contient AUCUN `if (type === ...)` métier :
 * il lit ce registre. Ajouter un type ne doit JAMAIS toucher le cœur.
 *
 * Le moteur ne stocke ni n'interprète le `payload` d'un événement : il est
 * opaque. Le descripteur d'affichage (`display`) est séparé (même séparation que
 * l'ADR-002 du Wallet). Ce registre décrit la structure de vie et de présentation.
 *
 * RAPPEL PHILOSOPHIE : un Événement est une INITIATIVE locale accompagnée de sa
 * création (brouillon) à son archivage — pas un simple « fait observé » de la ville.
 */

const lifecycle = require('./lifecycle');

// ── Sources / producteurs d'initiatives ───────────────────────────────────────
// La majorité des initiatives NAISSENT dans Ma Zone. Cette énumération est
// volontairement ouverte aux futurs producteurs sans refonte du cœur.
const SOURCE_KIND = {
  MERCHANT: 'merchant',
  ADMIN: 'admin',
  SYSTEM: 'system',
  DRIVER: 'driver',
  ASSOCIATION: 'association',
  ARTIST: 'artist',
  CITIZEN: 'citizen',
  AI: 'ai',
};
const KNOWN_SOURCE_KINDS = new Set(Object.values(SOURCE_KIND));

// ── Visibilité de l'audience ──────────────────────────────────────────────────
const VISIBILITY = {
  PUBLIC: 'public',
  TARGETED: 'targeted',
};

// ── Types d'entrées du journal (biographie append-only de l'initiative) ───────
const JOURNAL_EVENT_TYPE = {
  CREATED: 'created',
  UPDATED: 'updated',
  TRANSITIONED: 'transitioned',
  PUBLISHED: 'published',
  CANCELLED: 'cancelled',
  DIFFUSED: 'diffused',
  TICKET_ISSUED: 'ticket_issued',
  DISCOVERED: 'discovered',
};

// ── Contrat de capacités (garde anti « super-moteur ») ────────────────────────
// Une capacité décrit ce que l'initiative REND POSSIBLE ; elle n'exécute rien
// elle-même. L'exécution réelle est déléguée à un organe (Wallet, Identity,
// Communication). Seules ces capacités connues sont acceptées (fail-fast).
const KNOWN_CAPABILITIES = new Set([
  'canTicket',   // billetterie → orchestre Wallet (event_ticket)
  'canRSVP',     // participation déclarative (event_participations, phase ultérieure)
  'isLantern',   // découverte physique → orchestre Identity + Wallet
  'isMurmur',    // projection curatée et poétique
  'hasCapacity', // jauge / places limitées
  'isFlyable',   // éligible à une Opportunité Volante (stratégie de diffusion)
]);

// ── Canaux de diffusion (catégories du Mode Réception) ────────────────────────
// Ce ne sont PAS de simples filtres UI : ce sont les canaux sur lesquels le
// moteur diffuse les initiatives. Déclarés ici, évolutifs sans toucher au cœur.
const CHANNELS = [
  { id: 'culture', label: 'Culture' },
  { id: 'gastronomie', label: 'Gastronomie' },
  { id: 'solidarite', label: 'Solidarité' },
  { id: 'associations', label: 'Associations' },
  { id: 'artistes', label: 'Artistes' },
  { id: 'createurs', label: 'Créateurs' },
  { id: 'artisans', label: 'Artisans' },
  { id: 'commerces', label: 'Commerces' },
  { id: 'sport', label: 'Sport' },
  { id: 'famille', label: 'Famille' },
  { id: 'nature', label: 'Nature' },
  { id: 'patrimoine', label: 'Patrimoine' },
  { id: 'vie_de_quartier', label: 'Vie de quartier' },
  { id: 'lanternes', label: 'Lanternes' },
  { id: 'opportunites_rares', label: 'Opportunités rares' },
];
const CHANNELS_BY_ID = new Map(CHANNELS.map((c) => [c.id, c]));

/**
 * Normalise une déclaration de type avec des valeurs par défaut saines.
 * Garde les déclarations (types/*.js) minimales et lisibles.
 */
function defineEventType(def) {
  if (!def || !def.type) {
    throw new Error('[EventRegistry] Type invalide : `type` est requis.');
  }
  return {
    type: def.type,
    label: def.label || def.type,
    // Cycle de vie : générique par défaut, spécialisable par type (ex. Lanterne).
    initialStatus: def.initialStatus || lifecycle.EVENT_STATUS.DRAFT,
    lifecycle: def.lifecycle || lifecycle.DEFAULT_LIFECYCLE,
    // Diffusion : canaux proposés par défaut à ce type (le producteur ajuste).
    defaultChannels: def.defaultChannels || [],
    // Capacités : ce que l'initiative rend possible (délégué aux organes).
    capabilities: def.capabilities || {},
    // Validation minimale du payload à la création (liste de clés requises).
    requiredPayload: def.requiredPayload || [],
    // Projection d'affichage : le cœur n'interprète jamais le payload lui-même.
    display: typeof def.display === 'function' ? def.display : null,
  };
}

const TYPES = {};

/**
 * Enregistre un type dans le registre (appelé par chaque fichier types/*.js).
 * Fail-fast : rejette les doublons, capacités et canaux inconnus.
 */
function registerType(def) {
  const t = defineEventType(def);
  if (TYPES[t.type]) {
    throw new Error(`[EventRegistry] Type déjà déclaré : ${t.type}`);
  }
  for (const cap of Object.keys(t.capabilities)) {
    if (!KNOWN_CAPABILITIES.has(cap)) {
      throw new Error(
        `[EventRegistry] Capacité inconnue "${cap}" pour le type "${t.type}". ` +
        `Capacités valides : ${[...KNOWN_CAPABILITIES].join(', ')}.`
      );
    }
  }
  for (const ch of t.defaultChannels) {
    if (!CHANNELS_BY_ID.has(ch)) {
      throw new Error(
        `[EventRegistry] Canal par défaut inconnu "${ch}" pour le type "${t.type}".`
      );
    }
  }
  TYPES[t.type] = t;
  return t;
}

// ── API du registre (lecture seule, pure) ─────────────────────────────────────

function isKnownType(type) {
  return Object.prototype.hasOwnProperty.call(TYPES, type);
}

function getType(type) {
  return TYPES[type] || null;
}

/** Métadonnées des types (sans la fonction `display`), pour l'API/production. */
function listTypes() {
  return Object.values(TYPES).map(({ display, ...meta }) => meta);
}

function isKnownChannel(channelId) {
  return CHANNELS_BY_ID.has(channelId);
}

function getChannels() {
  return CHANNELS;
}

function isKnownSourceKind(kind) {
  return KNOWN_SOURCE_KINDS.has(kind);
}

/** Le type possède-t-il une capacité donnée (canTicket, isLantern…) ? */
function hasCapability(type, capability) {
  return !!TYPES[type]?.capabilities?.[capability];
}

/**
 * Projette la présentation d'un événement via la fonction `display` du type.
 * Si le type n'en fournit pas, on retombe sur le `display` stocké tel quel.
 * Le cœur n'interprète jamais le payload : c'est le type qui le fait.
 */
function project(type, row) {
  const def = TYPES[type];
  if (def?.display) {
    try {
      return def.display(row);
    } catch {
      return row.display || null;
    }
  }
  return row.display || null;
}

module.exports = {
  SOURCE_KIND,
  VISIBILITY,
  JOURNAL_EVENT_TYPE,
  KNOWN_CAPABILITIES,
  CHANNELS,
  registerType,
  defineEventType,
  isKnownType,
  getType,
  listTypes,
  isKnownChannel,
  getChannels,
  isKnownSourceKind,
  hasCapability,
  project,
};
