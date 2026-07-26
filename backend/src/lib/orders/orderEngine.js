/**
 * Organe Orders — le moteur.
 *
 * Avant l'étape 3, créer une commande enchaînait neuf effets dans un fichier de
 * route : décrément de stock HORS transaction, insertion commande, insertion
 * mission, conversation, notification, dispatch, et quatre émissions socket dont
 * certaines à l'INTÉRIEUR d'une transaction. Un échec au milieu laissait la base
 * dans un état que personne ne savait décrire.
 *
 * Ce que le moteur fait :
 *   - il décide de la validité d'une commande et de ses transitions ;
 *   - il écrit dans UNE transaction (Loi 6) ;
 *   - il journalise chaque décision, dans la même transaction (Loi 9) ;
 *   - il publie des faits, jamais des ordres (Loi 8), et seulement après commit (Loi 7).
 *
 * Ce qu'il ne fait PAS :
 *   - il ne compte pas le stock : il DEMANDE une réservation à l'organe Inventory ;
 *   - il ne choisit aucun livreur : c'est la décision de l'organe Dispatch ;
 *   - il n'émet aucun socket et n'envoie aucune notification : des abonnés le font ;
 *   - il ne connaît aucun logiciel tiers (Loi 1).
 *
 * Il possède `orders` et `order_journal`. Il DÉLÈGUE `missions` à l'organe Dispatch
 * et `stock_levels` à l'organe Inventory, qui en sont propriétaires.
 */

const db = require('../../db');
const { txn, idempotency } = require('../kernel');
const inventory = require('../inventory');
const { getEffectivePrice, consumePromoStock, restorePromoStock } = require('../promotions');
const { estimateDeliveryMinutes } = require('../geo');
const { getFullOrder } = require('./projection');
const lifecycle = require('./lifecycle');
const { orderJournal, ORDER_JOURNAL_TYPE } = require('./orderJournal');

const IDEMPOTENCY_SCOPE = 'orders.create';

class OrderError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = 'OrderError';
    this.status = status;
  }
}

/**
 * Écritures sur `missions`, déléguées à leur propriétaire.
 *
 * Requis paresseusement : `dispatch.js` lit les commandes, l'organe Orders écrit
 * les missions. Un `require` en tête de fichier créerait un cycle résolu à moitié
 * au premier chargement.
 */
function missions() {
  return require('../dispatch');
}

/** Commande brute, sans les jointures d'affichage. Base de toute décision. */
function getOrderRow(orderId) {
  return db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
}

/** Commande enrichie, telle que les surfaces l'attendent. Lecture seule. */
function getOrder(orderId) {
  return getFullOrder(orderId);
}

// ── Création ──────────────────────────────────────────────────────────────────

/**
 * Crée une commande et sa mission de livraison, en une transaction.
 *
 * Le dispatch n'est PAS appelé ici. La commande naît « en recherche de livreur »,
 * et c'est un appelant explicite qui demande au dispatch de chercher (voir
 * `orders/placement.js`). Le moteur reste utilisable sans dispatch : c'est ce qui
 * permettra, à l'étape 5, de faire de l'enchaînement une étape d'intention.
 *
 * @param {object} params
 * @param {string} params.clientId
 * @param {string} params.productId
 * @param {number} [params.quantity]
 * @param {string} [params.deliveryAddress]
 * @param {number} [params.deliveryLat]
 * @param {number} [params.deliveryLng]
 * @param {string|null} [params.idempotencyKey] rejouer renvoie la même commande
 * @returns {{ order: object, mission: object, replayed: boolean }}
 */
function createOrder({
  clientId,
  productId,
  quantity = 1,
  deliveryAddress = null,
  deliveryLat = null,
  deliveryLng = null,
  idempotencyKey = null,
}) {
  if (!productId) throw new OrderError('product_id requis', 400);

  const requestedQuantity = Number.parseInt(quantity, 10);
  if (!Number.isFinite(requestedQuantity) || requestedQuantity < 1) {
    throw new OrderError('quantity doit être un entier positif', 400);
  }

  const payload = { clientId, productId, quantity: requestedQuantity };

  const { orderId, missionId, replayed } = txn.run((ctx) => {
    // LOI 10 : un client mobile qui perd le réseau après l'envoi ne sait pas si sa
    // commande existe. Il réessaie. Sans clé, il vient d'acheter deux fois.
    //
    // La consultation ET l'enregistrement de la clé sont DANS la transaction : une
    // clé enregistrée après commit laisserait une fenêtre où un crash produit un
    // doublon, et une clé enregistrée sur une transaction annulée bloquerait pour
    // toujours une commande qui n'a jamais existé.
    const prior = idempotency.lookup(IDEMPOTENCY_SCOPE, idempotencyKey, { payload });
    if (prior) return { ...prior.result, replayed: true };

    const created = insertOrder(ctx, {
      clientId,
      productId,
      quantity: requestedQuantity,
      deliveryAddress,
      deliveryLat,
      deliveryLng,
      idempotencyKey,
    });

    idempotency.remember(IDEMPOTENCY_SCOPE, idempotencyKey, created, {
      payload,
      actor: clientId,
    });

    return { ...created, replayed: false };
  });

  return {
    order: getOrder(orderId),
    mission: db.prepare('SELECT * FROM missions WHERE id = ?').get(missionId),
    replayed,
  };
}

/** Corps de la création. Toujours appelé dans une transaction. */
function insertOrder(ctx, {
  clientId, productId, quantity, deliveryAddress, deliveryLat, deliveryLng, idempotencyKey,
}) {
  const product = db
    .prepare('SELECT * FROM products WHERE id = ? AND active = 1')
    .get(productId);
  if (!product) throw new OrderError('Produit introuvable', 404);

  const client = db.prepare('SELECT * FROM users WHERE id = ?').get(clientId);
  if (!client) throw new OrderError('Client introuvable', 404);

  const store = db.prepare('SELECT * FROM stores WHERE id = ?').get(product.store_id);
  if (!store) throw new OrderError('Boutique introuvable', 404);

  const unitPrice = getEffectivePrice(product);
  const totalPrice = unitPrice * quantity;
  const address = deliveryAddress || client.address || '';
  const estimatedMinutes = estimateDeliveryMinutes({
    storeLat: store.lat,
    storeLng: store.lng,
    clientLat: deliveryLat ?? client.lat,
    clientLng: deliveryLng ?? client.lng,
  });

  const orderId = db.generateId();

  // Le stock n'appartient plus à l'organe Orders : il demande une réservation, et
  // l'organe Inventory décide si elle est possible. Un refus (409) fait échouer la
  // transaction entière, donc aucune commande n'existe sans stock réservé.
  const level = inventory.reserve({
    productId,
    quantity,
    reference: orderId,
    actor: clientId,
  });

  const promoConsumed = consumePromoStock(productId, quantity);

  db.prepare(`
    INSERT INTO orders
      (id, client_id, product_id, store_id, quantity, total_price, status,
       delivery_address, estimated_minutes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    orderId, clientId, productId, store.id, quantity, totalPrice,
    lifecycle.INITIAL_STATUS, address, estimatedMinutes
  );

  // La mission naît avec la commande, dans la même transaction : une commande sans
  // mission serait invisible du dispatch, donc jamais livrée.
  const missionId = missions().createMissionForOrder(orderId);

  orderJournal.append(orderId, {
    type: ORDER_JOURNAL_TYPE.CREATED,
    toStatus: lifecycle.INITIAL_STATUS,
    actor: clientId,
    idempotencyKey,
    payload: { productId, quantity, unitPrice, totalPrice, storeId: store.id, missionId },
  });
  orderJournal.append(orderId, {
    type: ORDER_JOURNAL_TYPE.STOCK_CONSUMED,
    actor: clientId,
    // La promotion consommée est journalisée : sans cette trace, l'annulation ne
    // saurait pas à QUELLE promotion rendre ses unités. Entre-temps la promotion a
    // pu expirer ou être remplacée.
    payload: {
      productId,
      quantity,
      remaining: level.available,
      promotion: promoConsumed,
    },
  });

  ctx.publish('order.created', {
    orderId,
    missionId,
    clientId,
    storeId: store.id,
    merchantId: store.merchant_id,
    productId,
    quantity,
    remainingStock: level.available,
  });

  return { orderId, missionId };
}

// ── Transitions ───────────────────────────────────────────────────────────────

/**
 * Fait avancer une commande. Fail-fast : une transition interdite lève un 409 et
 * n'écrit rien. C'est le seul chemin autorisé pour changer le statut d'une
 * commande hors création et annulation.
 *
 * @param {string} orderId
 * @param {string} toStatus
 * @param {{ actor?: string|null, reason?: string|null }} [options]
 * @returns {object} commande enrichie
 */
function transitionOrder(orderId, toStatus, { actor = null, reason = null } = {}) {
  return txn.run((ctx) => {
    const order = getOrderRow(orderId);
    if (!order) throw new OrderError('Commande introuvable', 404);

    const fromStatus = lifecycle.normalizeOrderStatus(order.status);
    const target = lifecycle.normalizeOrderStatus(toStatus);

    // Rejouer la même transition est sans effet, pas une erreur : un livreur qui
    // appuie deux fois sur « colis récupéré » ne doit pas voir d'échec.
    if (fromStatus === target) return getOrder(orderId);

    lifecycle.assertTransition(fromStatus, target);

    db.prepare("UPDATE orders SET status = ?, updated_at = datetime('now') WHERE id = ?")
      .run(target, orderId);

    orderJournal.append(orderId, {
      type: ORDER_JOURNAL_TYPE.TRANSITIONED,
      fromStatus,
      toStatus: target,
      actor,
      payload: reason ? { reason } : null,
    });

    // La marchandise est remise au client : la réservation devient une sortie
    // définitive. C'est le seul endroit du système qui consomme du stock physique,
    // et c'est volontairement une conséquence de la LIVRAISON, pas de la commande.
    if (target === lifecycle.ORDER_STATUS.DELIVERED) {
      consumeReservation(order, { actor });
    }

    ctx.publish('order.transitioned', { orderId, fromStatus, toStatus: target, actor });

    return getOrder(orderId);
  });
}

/**
 * Consomme la réservation d'une commande livrée.
 *
 * Tolérante par conception : une commande antérieure à l'étape 4 n'a aucune
 * réservation enregistrée, son stock ayant été décrémenté à la création. Refuser la
 * livraison pour cette raison bloquerait des commandes en cours au moment de la
 * migration.
 */
function consumeReservation(order, { actor }) {
  const open = inventory.reservedFor(order.id, order.product_id);
  if (open <= 0) return;

  inventory.commit({
    productId: order.product_id,
    quantity: Math.min(open, order.quantity),
    reference: order.id,
    actor,
  });

  orderJournal.append(order.id, {
    type: ORDER_JOURNAL_TYPE.STOCK_COMMITTED,
    actor,
    payload: { productId: order.product_id, quantity: Math.min(open, order.quantity) },
  });
}

// ── Annulation ────────────────────────────────────────────────────────────────

/**
 * Annule une commande, libère sa mission et restitue le stock réservé.
 *
 * Le moteur ne notifie personne et ne réattribue aucun livreur : ce sont des
 * conséquences, traitées après commit par les abonnés et par l'appelant.
 *
 * @param {string} orderId
 * @param {{ actor?: string|null, reason?: string|null }} [options]
 * @returns {{ order: object, restoredQuantity: number, mission: object|null }}
 */
function cancelOrder(orderId, { actor = null, reason = null } = {}) {
  return txn.run((ctx) => {
    const order = getOrderRow(orderId);
    if (!order) throw new OrderError('Commande introuvable', 404);

    const fromStatus = lifecycle.normalizeOrderStatus(order.status);
    if (!lifecycle.canClientCancel(fromStatus)) {
      throw new OrderError('Cette commande ne peut plus être annulée.', 409);
    }

    const mission = db.prepare('SELECT * FROM missions WHERE order_id = ?').get(orderId);

    db.prepare("UPDATE orders SET status = ?, updated_at = datetime('now') WHERE id = ?")
      .run(lifecycle.ORDER_STATUS.CANCELLED, orderId);

    missions().releaseMissionForOrder(orderId);

    const restored = restoreReservation(order, { actor });
    const promotion = restorePromotion(order, { actor });

    orderJournal.append(orderId, {
      type: ORDER_JOURNAL_TYPE.CANCELLED,
      fromStatus,
      toStatus: lifecycle.ORDER_STATUS.CANCELLED,
      actor,
      payload: reason ? { reason } : null,
    });
    orderJournal.append(orderId, {
      type: ORDER_JOURNAL_TYPE.STOCK_RESTORED,
      actor,
      payload: { productId: order.product_id, quantity: restored.quantity, promotion },
    });

    ctx.publish('order.cancelled', {
      orderId,
      fromStatus,
      actor,
      clientId: order.client_id,
      storeId: order.store_id,
      productId: order.product_id,
      quantity: order.quantity,
      restoredStock: restored.available,
      missionId: mission?.id || null,
      driverId: mission?.driver_id || null,
      offeredDriverId: mission?.offered_to_driver_id || null,
    });

    return {
      order: getOrder(orderId),
      restoredQuantity: restored.quantity,
      mission: mission || null,
    };
  });
}

/**
 * Rend le stock réservé par une commande annulée.
 *
 * On ne rend QUE ce qui reste réservé pour cette commande. C'est l'invariant qui
 * empêche une annulation de créer du stock : deux annulations de la même commande ne
 * peuvent pas rendre deux fois la marchandise.
 */
function restoreReservation(order, { actor }) {
  const open = inventory.reservedFor(order.id, order.product_id);
  if (open <= 0) {
    return { quantity: 0, available: inventory.getSellableQty(order.product_id) };
  }

  const level = inventory.release({
    productId: order.product_id,
    quantity: open,
    reference: order.id,
    actor,
    reason: 'commande annulée',
  });

  return { quantity: open, available: level.available };
}

/**
 * Rend les unités promotionnelles d'une commande annulée.
 *
 * Corrige un bug réel : avant l'étape 4, `promotions.remaining_quantity` était
 * décrémenté à la vente et jamais restitué. Une série d'annulations épuisait donc
 * une promotion qui n'avait rien vendu.
 *
 * La promotion visée est lue dans le journal, pas déduite du produit : entre la
 * vente et l'annulation, elle a pu expirer ou être remplacée.
 */
function restorePromotion(order, { actor }) {
  const entry = orderJournal.lastOfType(order.id, ORDER_JOURNAL_TYPE.STOCK_CONSUMED);
  const promotion = entry?.payload?.promotion;
  if (!promotion?.promotionId) return null;

  restorePromoStock(promotion.promotionId, promotion.quantity);
  return { ...promotion, restoredBy: actor };
}

/** Historique complet d'une commande (Loi 9). */
function readJournal(orderId) {
  return orderJournal.read(orderId);
}

module.exports = {
  createOrder,
  transitionOrder,
  cancelOrder,
  getOrder,
  getOrderRow,
  readJournal,
  OrderError,
  IDEMPOTENCY_SCOPE,
};
