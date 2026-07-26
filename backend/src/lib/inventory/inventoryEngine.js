/**
 * Organe Inventory — le moteur.
 *
 * Ce qu'il fait :
 *   - il est le SEUL écrivain de `reserved` ;
 *   - il est le SEUL écrivain de `on_hand` en mode `mazone` ;
 *   - il journalise chaque mouvement, dans la même transaction (Loi 9) ;
 *   - il publie des faits après commit (Loi 7).
 *
 * Ce qu'il ne fait PAS — et c'est ce qui le rend réutilisable :
 *   - il ne sait pas ce qu'est une commande, un client ou une livraison ;
 *   - il ne décide PAS si une vente est légitime, seulement si le stock la permet ;
 *   - il ne connaît aucun logiciel tiers (Loi 1).
 *
 * Il possède `stock_levels` et `stock_movements`, et lui seul écrit la projection
 * `products.quantity`.
 */

const { txn } = require('../kernel');
const levels = require('./stockLevels');
const movements = require('./movements');
const {
  MOVEMENT_KIND,
  MOVEMENT_ORIGIN,
  InventoryError,
  InsufficientStockError,
  canReserve,
  ownsOnHand,
  mayMirrorOnHand,
  assertOriginMayDo,
  assertPositiveQuantity,
  assertStockCount,
} = require('./policy');

/**
 * Réserve du stock pour une vente à venir.
 *
 * Opération COMPENSABLE : son inverse est `release`. C'est exactement ce dont le
 * process manager de l'étape 5 a besoin — une intention de vente qui échoue à
 * l'étape suivante doit pouvoir défaire cette réservation.
 *
 * @param {object} params
 * @param {string} params.productId
 * @param {number} params.quantity
 * @param {string|null} [params.variantId]
 * @param {string|null} [params.reference] commande concernée
 * @param {string|null} [params.actor]
 * @returns {object} ligne de stock après réservation
 * @throws {InsufficientStockError} 409 si la disponibilité ne suffit pas
 */
function reserve({ productId, quantity, variantId = null, reference = null, actor = null }) {
  const qty = assertPositiveQuantity(quantity);

  return txn.run((ctx) => {
    const level = levels.ensure(productId, variantId);

    // Lecture et écriture dans la MÊME transaction : c'est ce qui supprime la
    // survente. Avant, `products.quantity` était lu, puis décrémenté par un
    // `UPDATE` séparé, et deux ventes simultanées sur la dernière unité passaient
    // toutes les deux.
    if (!canReserve(level, qty)) {
      throw new InsufficientStockError(productId, qty, level.available);
    }

    const updated = levels.write(level, { reserved: level.reserved + qty });

    movements.append({
      productId, variantId, kind: MOVEMENT_KIND.RESERVE, quantity: qty,
      origin: MOVEMENT_ORIGIN.MAZONE, level: updated, reference, actor,
    });

    ctx.publish('inventory.reserved', {
      productId, variantId, quantity: qty, reference,
      available: updated.available, storeId: null,
    });

    return updated;
  });
}

/**
 * Libère une réservation qui n'aboutira pas.
 *
 * On ne libère JAMAIS plus que ce qui a été réservé pour cette référence. Sans ce
 * garde-fou, une double annulation créerait du stock qui n'existe pas.
 */
function release({ productId, quantity, variantId = null, reference = null, actor = null, reason = null }) {
  const qty = assertPositiveQuantity(quantity);

  return txn.run((ctx) => {
    const level = levels.ensure(productId, variantId);

    const releasable = reference ? reservedFor(reference, productId) : level.reserved;
    if (qty > releasable) {
      throw new InventoryError(
        `Impossible de libérer ${qty} unité(s) : ${releasable} réservée(s) pour cette référence.`,
        409
      );
    }

    const updated = levels.write(level, { reserved: level.reserved - qty });

    movements.append({
      productId, variantId, kind: MOVEMENT_KIND.RELEASE, quantity: qty,
      origin: MOVEMENT_ORIGIN.MAZONE, level: updated, reference, actor, reason,
    });

    ctx.publish('inventory.released', {
      productId, variantId, quantity: qty, reference, available: updated.available,
    });

    return updated;
  });
}

/**
 * Consomme définitivement une réservation : la marchandise est partie.
 *
 * En mode `mazone`, `on_hand` baisse. En mode `pos`, il ne baisse PAS : la caisse
 * détient la vérité physique et l'annoncera par `syncOnHand`. Décrémenter ici
 * produirait un double décrément — c'est le bug numéro un des intégrations de
 * stock, et la raison d'être de la matrice de propriété.
 */
function commit({ productId, quantity, variantId = null, reference = null, actor = null }) {
  const qty = assertPositiveQuantity(quantity);

  return txn.run((ctx) => {
    const level = levels.ensure(productId, variantId);

    const committable = reference ? reservedFor(reference, productId) : level.reserved;
    if (qty > committable) {
      throw new InventoryError(
        `Impossible de consommer ${qty} unité(s) : ${committable} réservée(s) pour cette référence.`,
        409
      );
    }

    const updated = levels.write(level, {
      reserved: level.reserved - qty,
      on_hand: ownsOnHand(level) ? level.on_hand - qty : level.on_hand,
    });

    movements.append({
      productId, variantId, kind: MOVEMENT_KIND.COMMIT, quantity: qty,
      origin: MOVEMENT_ORIGIN.MAZONE, level: updated, reference, actor,
      reason: ownsOnHand(level) ? null : 'on_hand miroir : décrément laissé à la caisse',
    });

    ctx.publish('inventory.committed', {
      productId, variantId, quantity: qty, reference, available: updated.available,
    });

    return updated;
  });
}

/**
 * Correction de stock par le commerçant : inventaire, casse, perte, réassort.
 *
 * `delta` signé. Interdit en mode `pos` : corriger localement un miroir crée une
 * divergence silencieuse que la prochaine synchronisation écrasera.
 */
function adjust({ productId, delta, variantId = null, actor = null, reason = null, origin = MOVEMENT_ORIGIN.MERCHANT }) {
  const change = Number.parseInt(delta, 10);
  if (!Number.isFinite(change) || change === 0) {
    throw new InventoryError('Le delta doit être un entier non nul.', 400);
  }
  assertOriginMayDo(origin, MOVEMENT_KIND.ADJUST);

  return txn.run((ctx) => {
    const level = levels.ensure(productId, variantId);
    assertMayWriteOnHand(level);

    // Plancher à zéro plutôt qu'une erreur : un commerçant qui déclare « il ne
    // m'en reste plus » ne doit pas se heurter à un refus arithmétique.
    const nextOnHand = Math.max(0, level.on_hand + change);
    const updated = levels.write(level, { on_hand: nextOnHand });

    movements.append({
      productId, variantId, kind: MOVEMENT_KIND.ADJUST, quantity: Math.abs(change),
      origin, level: updated, actor,
      reason: reason || (change > 0 ? 'réassort' : 'correction à la baisse'),
    });

    ctx.publish('inventory.adjusted', {
      productId, variantId, delta: change, onHand: updated.on_hand,
      available: updated.available,
    });

    return updated;
  });
}

/**
 * Déclare le stock physique en valeur ABSOLUE.
 *
 * Seule porte d'entrée du stock physique venu de l'extérieur, et seule opération
 * qu'un connecteur ait le droit d'appeler. `reserved` n'est jamais touché : une
 * caisse ne sait pas ce que Ma Zone a promis à un client.
 *
 * ÉTAPE 6 — l'origine ne suffit pas, le MODE décide aussi. Un connecteur ne peut
 * déclarer `on_hand` que sur une ligne en mode `pos`. Sur une ligne en mode `mazone`,
 * l'appel est refusé et l'Integration Engine en fait un conflit visible plutôt qu'une
 * quantité qui change sans raison sous les yeux du commerçant.
 */
function syncOnHand({ productId, onHand, variantId = null, origin = MOVEMENT_ORIGIN.CONNECTOR, actor = null, reason = null }) {
  const value = assertStockCount(onHand, 'quantité en stock');
  assertOriginMayDo(origin, MOVEMENT_KIND.SYNC_ON_HAND);

  return txn.run((ctx) => {
    const level = levels.ensure(productId, variantId);
    if (origin === MOVEMENT_ORIGIN.CONNECTOR) assertMayMirrorOnHand(level);
    else assertMayWriteOnHand(level);

    const updated = levels.write(level, { on_hand: value });

    movements.append({
      productId, variantId, kind: MOVEMENT_KIND.SYNC_ON_HAND, quantity: value,
      origin, level: updated, actor, reason,
    });

    ctx.publish('inventory.synced', {
      productId, variantId, onHand: value, available: updated.available,
    });

    return updated;
  });
}

/**
 * Le commerçant déclare COMBIEN IL PEUT VENDRE, et l'organe en déduit `on_hand`.
 *
 * Cette opération existe pour une raison d'interface, pas de modèle, et elle mérite
 * d'être expliquée. Les écrans commerçant affichent `products.quantity`, qui est
 * devenu la projection de `available`. Quand le commerçant renvoie ce nombre dans un
 * formulaire, il renvoie donc du VENDABLE, pas du physique. L'interpréter comme un
 * `on_hand` absolu ferait fondre le stock à chaque enregistrement dès qu'une
 * commande est en cours :
 *
 *     on_hand 12, reserved 2 → affiché 10 → réenregistré tel quel
 *     → on_hand 10, reserved 2 → affiché 8. Le commerçant a perdu 2 unités.
 *
 *     on_hand = vendable_déclaré + reserved + safety_buffer
 *
 * Cette traduction disparaît à l'étape 7 : l'API v1 exposera `on_hand` explicitement
 * aux surfaces commerçant, et le formulaire déclarera du physique.
 */
function declareSellable({ productId, sellable, variantId = null, origin = MOVEMENT_ORIGIN.MERCHANT, actor = null, reason = null }) {
  const target = assertStockCount(sellable, 'quantité vendable');
  assertOriginMayDo(origin, MOVEMENT_KIND.SYNC_ON_HAND);

  return txn.run((ctx) => {
    const level = levels.ensure(productId, variantId);
    assertMayWriteOnHand(level);

    const onHand = target + level.reserved + level.safety_buffer;
    const updated = levels.write(level, { on_hand: onHand });

    movements.append({
      productId, variantId, kind: MOVEMENT_KIND.SYNC_ON_HAND, quantity: onHand,
      origin, level: updated, actor,
      reason: reason || `vendable déclaré à ${target}`,
    });

    ctx.publish('inventory.synced', {
      productId, variantId, onHand, available: updated.available,
    });

    return updated;
  });
}

// ── Lectures ──────────────────────────────────────────────────────────────────

/** Quantité vendable. La seule valeur qu'une surface client a le droit de voir. */
function getSellableQty(productId, variantId = null) {
  const level = levels.find(productId, variantId);
  if (level) return level.available;
  // Produit jamais adopté par l'organe : on ne crée pas de ligne pour une simple
  // lecture, on retombe sur le compteur historique.
  return legacyQuantity(productId);
}

/** État complet. Réservé aux surfaces commerçant (Loi 12). */
function getLevel(productId, variantId = null) {
  return levels.find(productId, variantId) || null;
}

/** Recalcule la projection depuis la vérité et la renvoie. */
function recomputeAvailable(productId, variantId = null) {
  return txn.run(() => levels.recompute(productId, variantId));
}

/** Historique des mouvements d'un produit. */
function readMovements(productId, options) {
  return movements.read(productId, options);
}

// ── Internes ──────────────────────────────────────────────────────────────────

function legacyQuantity(productId) {
  const row = require('../../db')
    .prepare('SELECT quantity FROM products WHERE id = ?')
    .get(productId);
  return row?.quantity ?? 0;
}

/** Réservations encore ouvertes pour une référence donnée. */
function reservedFor(reference, productId) {
  const rows = movements.readByReference(reference).filter((m) => m.product_id === productId);
  let open = 0;
  for (const m of rows) {
    if (m.kind === MOVEMENT_KIND.RESERVE) open += m.quantity;
    else if (m.kind === MOVEMENT_KIND.RELEASE || m.kind === MOVEMENT_KIND.COMMIT) open -= m.quantity;
  }
  return Math.max(0, open);
}

function assertMayWriteOnHand(level) {
  if (!ownsOnHand(level)) {
    throw new InventoryError(
      'Le stock physique de ce produit est un miroir de la caisse : il ne peut pas '
      + 'être corrigé depuis Ma Zone.',
      409
    );
  }
}

/**
 * Refus symétrique : un logiciel tiers déclare un stock que Ma Zone possède.
 *
 * Le message est écrit pour être lu par un commerçant dans son journal de conflits, pas
 * par un développeur dans une trace : il dit ce qui a été refusé ET le geste qui
 * l'autoriserait. `ownership` est renseigné pour que l'Integration Engine sache
 * qualifier le conflit sans avoir à interpréter une phrase.
 */
function assertMayMirrorOnHand(level) {
  if (!mayMirrorOnHand(level)) {
    const err = new InventoryError(
      'Le stock de ce produit est tenu dans Ma Zone : une quantité venue d\'un autre '
      + 'logiciel ne peut pas l\'écraser. Confiez la tenue du stock à ce logiciel pour '
      + 'que ses quantités soient reprises.',
      409
    );
    err.ownership = 'mazone';
    throw err;
  }
}

module.exports = {
  reserve,
  release,
  commit,
  adjust,
  syncOnHand,
  declareSellable,
  getSellableQty,
  getLevel,
  recomputeAvailable,
  readMovements,
  reservedFor,
};
