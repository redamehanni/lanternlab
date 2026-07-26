/**
 * Organe Inventory — règles de disponibilité.
 *
 * Un seul fichier répond à « combien puis-je vendre » et « qui a le droit d'écrire
 * quoi ». Isolé du stockage exprès : ces règles se lisent et se testent sans base.
 *
 * Le triple état existe pour une raison précise. `products.quantity` était un
 * compteur unique : rien ne distinguait « j'ai 3 unités en rayon » de « je peux
 * encore en vendre 3 ». Deux commandes simultanées sur la dernière unité
 * passaient toutes les deux, parce que la lecture et l'écriture étaient séparées.
 */

/** Modes de propriété du stock physique. */
const INVENTORY_OWNER = {
  /** Le commerçant tient son stock dans Ma Zone. Défaut, et chemin d'adoption A. */
  MAZONE: 'mazone',
  /**
   * Une caisse externe détient la vérité ; Ma Zone recopie.
   * EXERCÉ DEPUIS L'ÉTAPE 6 : c'est ce mode, et lui seul, qui autorise un connecteur
   * à écrire `on_hand` (voir `mayMirrorOnHand`). Il reste un mode entrant — aucun
   * connecteur ne le réclame encore, mais la frontière est désormais gardée.
   */
  POS: 'pos',
};

const INVENTORY_OWNERS = Object.values(INVENTORY_OWNER);

/** Origines possibles d'un mouvement. */
const MOVEMENT_ORIGIN = {
  MAZONE: 'mazone',
  CONNECTOR: 'connector',
  MERCHANT: 'merchant',
};

/** Natures de mouvement, telles que déclarées au CDM. */
const MOVEMENT_KIND = {
  RESERVE: 'reserve',
  RELEASE: 'release',
  COMMIT: 'commit',
  ADJUST: 'adjust',
  SYNC_ON_HAND: 'sync_on_hand',
};

class InventoryError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = 'InventoryError';
    this.status = status;
  }
}

class InsufficientStockError extends InventoryError {
  constructor(productId, requested, available) {
    super(`Stock insuffisant (${available} disponible)`);
    this.name = 'InsufficientStockError';
    this.productId = productId;
    this.requested = requested;
    this.available = available;
    // 409 et non 400 : la demande est bien formée, c'est l'état du stock qui la
    // refuse — et cet état peut changer à la seconde suivante.
    this.status = 409;
  }
}

/**
 * LOI 11 — `available` se calcule, ne se stocke jamais.
 *
 * Le plancher à zéro n'est pas de la complaisance : un `on_hand` corrigé à la
 * baisse pendant que des réservations existent donne un négatif, et un négatif
 * affiché au client serait pire qu'un zéro.
 */
function computeAvailable({ on_hand, reserved, safety_buffer }) {
  return Math.max(0, on_hand - reserved - safety_buffer);
}

/** Le stock permet-il cette réservation ? */
function canReserve(level, quantity) {
  return computeAvailable(level) >= quantity;
}

/**
 * Ma Zone a-t-elle le droit d'écrire `on_hand` ?
 *
 * Loi 3 appliquée à l'attribut : propriété en mode `mazone`, miroir en mode `pos`.
 * Écrire un miroir localement est un bug, pas une préférence.
 */
function ownsOnHand(level) {
  return level.inventory_owner === INVENTORY_OWNER.MAZONE;
}

/**
 * Un logiciel tiers a-t-il le droit de déclarer `on_hand` sur cette ligne ?
 *
 * Symétrique exacte de `ownsOnHand`, et ajoutée à l'étape 6 parce que c'est l'étape où
 * la question a cessé d'être théorique : jusque-là aucun connecteur n'existait, et
 * `syncOnHand` acceptait tout le monde sans que cela ait de conséquence.
 *
 * En mode `mazone`, la matrice de propriété est formelle : Ma Zone décide de `on_hand`,
 * « un logiciel tiers qui propose une autre valeur est en conflit, et c'est Ma Zone qui
 * gagne ». Laisser passer l'écriture ferait exactement l'inverse — le dernier écrivain
 * gagnerait, silencieusement, ce qui est précisément la mécanique que Ma Zone refuse.
 *
 * La conséquence est produit, pas seulement technique : un commerçant qui branche sa
 * caisse sans lui confier son stock voit apparaître des conflits au lieu de voir ses
 * quantités changer sans explication. Le transfert de propriété du stock devient un
 * geste qu'il pose, jamais un effet de bord d'un branchement.
 */
function mayMirrorOnHand(level) {
  return level.inventory_owner === INVENTORY_OWNER.POS;
}

/**
 * Écritures autorisées pour une origine donnée.
 *
 * Un connecteur ne peut RIEN faire d'autre que `syncOnHand`. C'est ce qui garantit
 * qu'un logiciel tiers ne peut jamais toucher `reserved` : aucune caisse ne sait ce
 * que Ma Zone a promis à un client.
 */
const ALLOWED_KINDS_BY_ORIGIN = {
  [MOVEMENT_ORIGIN.MAZONE]: [
    MOVEMENT_KIND.RESERVE,
    MOVEMENT_KIND.RELEASE,
    MOVEMENT_KIND.COMMIT,
  ],
  [MOVEMENT_ORIGIN.MERCHANT]: [
    MOVEMENT_KIND.ADJUST,
    MOVEMENT_KIND.SYNC_ON_HAND,
  ],
  [MOVEMENT_ORIGIN.CONNECTOR]: [
    MOVEMENT_KIND.SYNC_ON_HAND,
  ],
};

function assertOriginMayDo(origin, kind) {
  const allowed = ALLOWED_KINDS_BY_ORIGIN[origin];
  if (!allowed) throw new InventoryError(`Origine de mouvement inconnue « ${origin} ».`, 400);
  if (!allowed.includes(kind)) {
    throw new InventoryError(
      `Une origine « ${origin} » ne peut pas produire un mouvement « ${kind} ».`,
      403
    );
  }
}

/** Quantité de mouvement : entier strictement positif, toujours. */
function assertPositiveQuantity(quantity) {
  const value = Number.parseInt(quantity, 10);
  if (!Number.isFinite(value) || value < 1) {
    throw new InventoryError('La quantité doit être un entier positif.', 400);
  }
  return value;
}

/** Quantité absolue de stock : entier ≥ 0. */
function assertStockCount(value, label = 'quantité') {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new InventoryError(`La ${label} doit être un entier positif ou nul.`, 400);
  }
  return parsed;
}

module.exports = {
  INVENTORY_OWNER,
  INVENTORY_OWNERS,
  MOVEMENT_ORIGIN,
  MOVEMENT_KIND,
  InventoryError,
  InsufficientStockError,
  computeAvailable,
  canReserve,
  ownsOnHand,
  mayMirrorOnHand,
  assertOriginMayDo,
  assertPositiveQuantity,
  assertStockCount,
  ALLOWED_KINDS_BY_ORIGIN,
};
