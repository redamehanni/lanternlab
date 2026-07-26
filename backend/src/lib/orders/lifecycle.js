/**
 * Organe Orders — cycle de vie d'une commande.
 *
 * Écrit sur le modèle exact de `eventEngine/lifecycle.js` : un graphe déclaratif,
 * une règle de transition FAIL-FAST, aucune dépendance vers le reste de l'organe.
 *
 * Avant l'étape 3, `lib/orderStatus.js` n'était qu'une liste de constantes. Aucun
 * graphe n'existait, donc `delivered → picking_up` était accepté, et une commande
 * livrée pouvait repartir en préparation. Une liste de statuts valides n'est pas
 * une machine à états : elle dit ce qui existe, pas ce qui est possible.
 */

// ── Statuts canoniques ────────────────────────────────────────────────────────
// Lecture produit → technique :
//   passée↔placed · en recherche de livreur↔pending_driver
//   livreur affecté↔driver_assigned · en route boutique↔picking_up
//   colis récupéré↔picked_up · en livraison↔delivering
//   livrée↔delivered · annulée↔cancelled
const ORDER_STATUS = {
  PLACED: 'placed',
  PENDING_DRIVER: 'pending_driver',
  DRIVER_ASSIGNED: 'driver_assigned',
  PICKING_UP: 'picking_up',
  PICKED_UP: 'picked_up',
  DELIVERING: 'delivering',
  DELIVERED: 'delivered',
  CANCELLED: 'cancelled',
};

/** Statuts historiques rencontrés en base, ramenés au vocabulaire canonique. */
const LEGACY_STATUS_MAP = {
  pending: ORDER_STATUS.PENDING_DRIVER,
  searching_driver: ORDER_STATUS.PENDING_DRIVER,
  offered: ORDER_STATUS.PENDING_DRIVER,
  accepted: ORDER_STATUS.DRIVER_ASSIGNED,
  accepted_by_driver: ORDER_STATUS.DRIVER_ASSIGNED,
};

const TERMINAL_STATUS = [ORDER_STATUS.DELIVERED, ORDER_STATUS.CANCELLED];

/**
 * Graphe de transitions. Une commande peut être annulée à tout moment AVANT que le
 * colis ne quitte la boutique ; après `picked_up`, elle ne peut plus qu'aboutir.
 *
 * `picking_up → pending_driver` existe volontairement : c'est le retour en file
 * d'attente quand un livreur abandonne avant d'avoir récupéré le colis. Sans cette
 * arête, la commande resterait bloquée sur un livreur qui ne viendra jamais.
 */
const LIFECYCLE = {
  [ORDER_STATUS.PLACED]: [
    ORDER_STATUS.PENDING_DRIVER,
    ORDER_STATUS.DRIVER_ASSIGNED,
    ORDER_STATUS.CANCELLED,
  ],
  [ORDER_STATUS.PENDING_DRIVER]: [
    ORDER_STATUS.DRIVER_ASSIGNED,
    ORDER_STATUS.CANCELLED,
  ],
  [ORDER_STATUS.DRIVER_ASSIGNED]: [
    ORDER_STATUS.PICKING_UP,
    ORDER_STATUS.PICKED_UP,
    ORDER_STATUS.PENDING_DRIVER,
    ORDER_STATUS.CANCELLED,
  ],
  [ORDER_STATUS.PICKING_UP]: [
    ORDER_STATUS.PICKED_UP,
    ORDER_STATUS.PENDING_DRIVER,
    ORDER_STATUS.CANCELLED,
  ],
  // Le colis est sorti de la boutique : plus d'annulation par ce chemin.
  [ORDER_STATUS.PICKED_UP]: [
    ORDER_STATUS.DELIVERING,
    ORDER_STATUS.DELIVERED,
  ],
  [ORDER_STATUS.DELIVERING]: [
    ORDER_STATUS.DELIVERED,
  ],
  [ORDER_STATUS.DELIVERED]: [],
  [ORDER_STATUS.CANCELLED]: [],
};

/** Statut d'une commande à sa création : personne n'est encore affecté. */
const INITIAL_STATUS = ORDER_STATUS.PENDING_DRIVER;

function normalizeOrderStatus(status) {
  return LEGACY_STATUS_MAP[status] || status;
}

function isKnownStatus(status) {
  return Object.prototype.hasOwnProperty.call(LIFECYCLE, normalizeOrderStatus(status));
}

function isTerminalStatus(status) {
  return TERMINAL_STATUS.includes(normalizeOrderStatus(status));
}

/** La transition est-elle autorisée par le graphe ? */
function canTransition(fromStatus, toStatus) {
  const from = normalizeOrderStatus(fromStatus);
  const to = normalizeOrderStatus(toStatus);
  if (from === to) return false;
  return (LIFECYCLE[from] || []).includes(to);
}

class OrderTransitionError extends Error {
  constructor(fromStatus, toStatus) {
    super(`Transition « ${fromStatus} → ${toStatus} » interdite pour une commande.`);
    this.name = 'OrderTransitionError';
    this.fromStatus = fromStatus;
    this.toStatus = toStatus;
    // 409 et non 400 : la demande est bien formée, c'est l'état actuel qui la refuse.
    this.status = 409;
  }
}

/**
 * Fail-fast. Une transition interdite lève au lieu de renvoyer un booléen que
 * l'appelant pourrait oublier de lire.
 */
function assertTransition(fromStatus, toStatus) {
  if (!isKnownStatus(toStatus)) {
    const err = new Error(`Statut de commande inconnu « ${toStatus} ».`);
    err.status = 400;
    throw err;
  }
  if (!canTransition(fromStatus, toStatus)) {
    throw new OrderTransitionError(normalizeOrderStatus(fromStatus), normalizeOrderStatus(toStatus));
  }
}

/**
 * Le client peut-il encore annuler ?
 *
 * Déduit du graphe plutôt que d'une liste séparée : deux sources de vérité pour la
 * même question finissent toujours par diverger.
 */
function canClientCancel(status) {
  return canTransition(status, ORDER_STATUS.CANCELLED);
}

/** Transitions possibles depuis un statut. Utile aux interfaces et au diagnostic. */
function allowedTransitions(status) {
  return [...(LIFECYCLE[normalizeOrderStatus(status)] || [])];
}

module.exports = {
  ORDER_STATUS,
  LEGACY_STATUS_MAP,
  TERMINAL_STATUS,
  LIFECYCLE,
  INITIAL_STATUS,
  normalizeOrderStatus,
  isKnownStatus,
  isTerminalStatus,
  canTransition,
  assertTransition,
  canClientCancel,
  allowedTransitions,
  OrderTransitionError,
};
