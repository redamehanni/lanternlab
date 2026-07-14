/**
 * Wallet Engine — Registre des types d'objets numériques.
 *
 * Point d'extension unique (principe Open/Closed) : un nouvel organe déclare
 * ici un `kind` (type d'objet) avec ses transitions autorisées, sa politique de
 * rétention et ses capacités par état. Le moteur (`walletEngine.js`) ne contient
 * aucune connaissance métier : il lit ce registre. Ajouter un type d'objet ne
 * doit JAMAIS nécessiter de modifier le cœur transactionnel.
 *
 * Le Wallet ne stocke ni n'interprète le `payload` d'un objet : il est opaque.
 * Ce registre décrit uniquement la structure de vie et de présentation.
 */

// ── Statuts génériques (couche dure / entitlement) ────────────────────────────
const OBJECT_STATUS = {
  PENDING: 'pending',
  ACTIVE: 'active',
  RESERVED: 'reserved',
  CONSUMED: 'consumed',
  EXPIRED: 'expired',
  REVOKED: 'revoked',
};

// Statuts terminaux : plus aucune transition d'entitlement possible.
const TERMINAL_STATUS = [OBJECT_STATUS.CONSUMED, OBJECT_STATUS.EXPIRED, OBJECT_STATUS.REVOKED];

// ── Politiques de rétention (B++) ─────────────────────────────────────────────
// ephemeral        : disparaît une fois son droit épuisé (ex. procuration)
// keepsake         : persiste comme souvenir / patrimoine (ex. billet de festival)
// entitlement_only : purement fonctionnel, pas de facette souvenir
const RETENTION = {
  EPHEMERAL: 'ephemeral',
  KEEPSAKE: 'keepsake',
  ENTITLEMENT_ONLY: 'entitlement_only',
};

// ── Types d'événements du ledger (biographie append-only de l'objet) ──────────
const EVENT_TYPE = {
  ISSUED: 'issued',
  CONSUMED: 'consumed',
  REVOKED: 'revoked',
  EXPIRED: 'expired',
  RESERVED: 'reserved',
  RELEASED: 'released',
  TRANSFERRED: 'transferred',
  ENRICHED: 'enriched',
};

// ── Familles d'objets (regroupement UX uniquement, jamais de logique métier) ──
const FAMILIES = [
  { id: 'billets', label: 'Billets', icon: 'ticket-outline', color: '#2563EB' },
  { id: 'retraits', label: 'Retraits', icon: 'cube-outline', color: '#059669' },
  { id: 'promotions', label: 'Promotions', icon: 'pricetag-outline', color: '#DC2626' },
  { id: 'fidelite', label: 'Fidélité', icon: 'heart-outline', color: '#DB2777' },
  { id: 'badges', label: 'Badges', icon: 'ribbon-outline', color: '#D97706' },
  { id: 'civique', label: 'Points civiques', icon: 'leaf-outline', color: '#16A34A' },
];

// Transitions génériques par défaut. Un kind peut fournir les siennes.
const DEFAULT_TRANSITIONS = {
  [OBJECT_STATUS.PENDING]: [OBJECT_STATUS.ACTIVE, OBJECT_STATUS.REVOKED, OBJECT_STATUS.EXPIRED],
  [OBJECT_STATUS.ACTIVE]: [
    OBJECT_STATUS.CONSUMED,
    OBJECT_STATUS.REVOKED,
    OBJECT_STATUS.EXPIRED,
    OBJECT_STATUS.RESERVED,
  ],
  [OBJECT_STATUS.RESERVED]: [
    OBJECT_STATUS.ACTIVE,
    OBJECT_STATUS.CONSUMED,
    OBJECT_STATUS.REVOKED,
    OBJECT_STATUS.EXPIRED,
  ],
  [OBJECT_STATUS.CONSUMED]: [],
  [OBJECT_STATUS.EXPIRED]: [],
  [OBJECT_STATUS.REVOKED]: [],
};

/**
 * Normalise une déclaration de kind avec les valeurs par défaut saines.
 * Garde les déclarations ci-dessous minimales et lisibles.
 */
function defineKind(def) {
  return {
    kind: def.kind,
    family: def.family,
    label: def.label,
    initialStatus: def.initialStatus || OBJECT_STATUS.ACTIVE,
    retention: def.retention || RETENTION.ENTITLEMENT_ONLY,
    consumable: def.consumable !== false,
    memoryEnabled: def.memoryEnabled === true,
    transitions: def.transitions || DEFAULT_TRANSITIONS,
    capabilities: def.capabilities || [],
  };
}

/**
 * Registre des kinds. Exemples représentatifs des familles Ma Zone.
 * Ce sont des DÉCLARATIONS (métadonnées), pas des implémentations métier :
 * les organes émetteurs restent responsables du sens des objets.
 */
const KINDS = {
  event_ticket: defineKind({
    kind: 'event_ticket',
    family: 'billets',
    label: "Billet d'événement",
    retention: RETENTION.KEEPSAKE,
    consumable: true,
    memoryEnabled: true,
    capabilities: [
      { id: 'show_qr', label: 'Afficher mon QR', icon: 'qr-code-outline', availableInStates: ['active'], handledBy: 'wallet' },
      { id: 'offer', label: 'Offrir', icon: 'gift-outline', availableInStates: ['active'], handledBy: 'wallet', invocation: 'wallet.transfer' },
      { id: 'add_calendar', label: 'Ajouter au calendrier', icon: 'calendar-outline', availableInStates: ['active'], handledBy: 'device' },
      { id: 'view_memory', label: 'Revoir le souvenir', icon: 'images-outline', availableInStates: ['consumed', 'expired'], handledBy: 'wallet' },
    ],
  }),

  pickup_ticket: defineKind({
    kind: 'pickup_ticket',
    family: 'retraits',
    label: 'Ticket de retrait',
    retention: RETENTION.EPHEMERAL,
    consumable: true,
    memoryEnabled: true,
    capabilities: [
      { id: 'show_qr', label: 'Afficher mon QR', icon: 'qr-code-outline', availableInStates: ['active'], handledBy: 'wallet' },
      { id: 'view_store', label: 'Voir le commerce', icon: 'storefront-outline', availableInStates: ['active'], handledBy: 'source' },
      { id: 'contact_merchant', label: 'Contacter le commerçant', icon: 'chatbubble-outline', availableInStates: ['active'], handledBy: 'source' },
      { id: 'view_receipt', label: "Souvenir d'achat", icon: 'receipt-outline', availableInStates: ['consumed'], handledBy: 'wallet' },
    ],
  }),

  promo_voucher: defineKind({
    kind: 'promo_voucher',
    family: 'promotions',
    label: 'Bon de promotion',
    retention: RETENTION.ENTITLEMENT_ONLY,
    consumable: true,
    memoryEnabled: false,
    capabilities: [
      { id: 'show_code', label: 'Afficher le code', icon: 'barcode-outline', availableInStates: ['active'], handledBy: 'wallet' },
      { id: 'view_offer', label: "Voir l'offre", icon: 'pricetag-outline', availableInStates: ['active'], handledBy: 'source' },
    ],
  }),

  loyalty_card: defineKind({
    kind: 'loyalty_card',
    family: 'fidelite',
    label: 'Carte de fidélité',
    retention: RETENTION.KEEPSAKE,
    consumable: false,
    memoryEnabled: false,
    capabilities: [
      { id: 'view_rewards', label: 'Voir mes récompenses', icon: 'gift-outline', availableInStates: ['active'], handledBy: 'source' },
      { id: 'view_store', label: 'Voir le commerce', icon: 'storefront-outline', availableInStates: ['active'], handledBy: 'source' },
    ],
  }),

  badge: defineKind({
    kind: 'badge',
    family: 'badges',
    label: 'Badge',
    retention: RETENTION.KEEPSAKE,
    consumable: false,
    memoryEnabled: false,
    capabilities: [
      { id: 'view_progress', label: 'Voir ma progression', icon: 'trending-up-outline', availableInStates: ['active'], handledBy: 'source' },
      { id: 'share', label: 'Partager', icon: 'share-social-outline', availableInStates: ['active'], handledBy: 'device' },
    ],
  }),

  civic_points: defineKind({
    kind: 'civic_points',
    family: 'civique',
    label: 'Points civiques',
    retention: RETENTION.KEEPSAKE,
    consumable: false,
    memoryEnabled: false,
    capabilities: [
      { id: 'view_history', label: "Voir l'historique", icon: 'time-outline', availableInStates: ['active'], handledBy: 'source' },
    ],
  }),
};

// ── API du registre (lecture seule, pure) ─────────────────────────────────────

function isKnownKind(kind) {
  return Object.prototype.hasOwnProperty.call(KINDS, kind);
}

function getKind(kind) {
  return KINDS[kind] || null;
}

function listKinds() {
  return Object.values(KINDS);
}

function getFamilies() {
  return FAMILIES;
}

function getFamilyOfKind(kind) {
  return KINDS[kind]?.family || null;
}

function getRetention(kind) {
  return KINDS[kind]?.retention || RETENTION.ENTITLEMENT_ONLY;
}

function getInitialStatus(kind) {
  return KINDS[kind]?.initialStatus || OBJECT_STATUS.ACTIVE;
}

/**
 * Vérifie qu'une transition d'état est autorisée pour ce type d'objet.
 */
function canTransition(kind, fromStatus, toStatus) {
  const def = KINDS[kind];
  const transitions = def?.transitions || DEFAULT_TRANSITIONS;
  const allowed = transitions[fromStatus] || [];
  return allowed.includes(toStatus);
}

/**
 * Retourne les capacités disponibles pour un objet dans un état donné.
 * Le moteur expose ces descripteurs ; il n'exécute jamais l'action métier
 * (déléguée à l'organe indiqué par `handledBy`).
 */
function getCapabilities(kind, status) {
  const def = KINDS[kind];
  if (!def) return [];
  return def.capabilities
    .filter((cap) => cap.availableInStates.includes(status))
    .map((cap) => ({
      id: cap.id,
      label: cap.label,
      icon: cap.icon,
      handledBy: cap.handledBy,
      invocation: cap.invocation || null,
    }));
}

module.exports = {
  OBJECT_STATUS,
  TERMINAL_STATUS,
  RETENTION,
  EVENT_TYPE,
  FAMILIES,
  DEFAULT_TRANSITIONS,
  isKnownKind,
  getKind,
  listKinds,
  getFamilies,
  getFamilyOfKind,
  getRetention,
  getInitialStatus,
  canTransition,
  getCapabilities,
};
