/**
 * Event Engine — Cycle de vie des initiatives locales.
 *
 * Une initiative accompagnée par Ma Zone existe DÈS le brouillon : le « fait qui
 * a lieu » (live) n'est qu'une phase parmi d'autres. Ce fichier décrit le graphe
 * de statuts canonique et la règle de transition (fail-fast). Un type d'événement
 * peut restreindre/spécialiser ce graphe via son propre `lifecycle` (ex. Lanterne),
 * mais le cœur ne contient aucune connaissance métier : il lit ces déclarations.
 *
 * Ce module ne dépend d'aucun autre du moteur (pas de cycle d'import) : le
 * registre et le cœur s'appuient dessus.
 */

// ── Statuts canoniques génériques ─────────────────────────────────────────────
// Lecture produit → technique :
//   brouillon↔draft · planification↔scheduled · publication↔published
//   déroulement↔live · clôture↔ended · archivage↔archived
const EVENT_STATUS = {
  DRAFT: 'draft',
  SCHEDULED: 'scheduled',
  PUBLISHED: 'published',
  LIVE: 'live',
  ENDED: 'ended',
  ARCHIVED: 'archived',
  CANCELLED: 'cancelled',
};

// Statuts terminaux : plus aucune transition de cycle de vie possible.
const TERMINAL_STATUS = [EVENT_STATUS.ARCHIVED, EVENT_STATUS.CANCELLED];

// Graphe de transitions générique par défaut. Un type peut fournir le sien.
const DEFAULT_LIFECYCLE = {
  [EVENT_STATUS.DRAFT]: [EVENT_STATUS.SCHEDULED, EVENT_STATUS.PUBLISHED, EVENT_STATUS.CANCELLED],
  [EVENT_STATUS.SCHEDULED]: [EVENT_STATUS.PUBLISHED, EVENT_STATUS.CANCELLED],
  [EVENT_STATUS.PUBLISHED]: [EVENT_STATUS.LIVE, EVENT_STATUS.ENDED, EVENT_STATUS.CANCELLED],
  [EVENT_STATUS.LIVE]: [EVENT_STATUS.ENDED, EVENT_STATUS.CANCELLED],
  [EVENT_STATUS.ENDED]: [EVENT_STATUS.ARCHIVED],
  [EVENT_STATUS.ARCHIVED]: [],
  [EVENT_STATUS.CANCELLED]: [],
};

/**
 * Statut initial d'une initiative pour un type donné : une initiative naît
 * toujours en brouillon, sauf si le type déclare explicitement un autre départ
 * (ex. Lanterne : `hidden`).
 */
function getInitialStatus(typeDef) {
  return typeDef?.initialStatus || EVENT_STATUS.DRAFT;
}

/**
 * Une transition est-elle autorisée pour ce type d'événement ?
 * Lit le graphe du type s'il en fournit un, sinon le graphe générique.
 */
function canTransition(typeDef, fromStatus, toStatus) {
  const graph = typeDef?.lifecycle || DEFAULT_LIFECYCLE;
  const allowed = graph[fromStatus] || [];
  return allowed.includes(toStatus);
}

/**
 * Statut « publié et visible » : sert aux projections de consommation.
 * Générique : un statut est diffusable dès qu'il n'est ni brouillon, ni
 * planification interne, ni terminal négatif.
 */
const DISCOVERABLE_STATUS = [EVENT_STATUS.PUBLISHED, EVENT_STATUS.LIVE, EVENT_STATUS.ENDED];

module.exports = {
  EVENT_STATUS,
  TERMINAL_STATUS,
  DEFAULT_LIFECYCLE,
  DISCOVERABLE_STATUS,
  getInitialStatus,
  canTransition,
};
