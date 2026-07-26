const db = require('../db');
const { ORDER_STATUS } = require('./orders/lifecycle');
const { getFullOrder } = require('./orders/projection');
const { getOrCreateConversation } = require('./conversations');
const { OFFER_MODE } = require('../config/dispatch');

const MISSION_ACTIVE = 'accepted';

function getFullMission(missionId) {
  return db.prepare(`
    SELECT m.*,
      o.client_id, o.delivery_address, o.total_price, o.status as order_status,
      o.quantity as order_quantity, o.estimated_minutes,
      p.name as product_name, p.image_url as product_image, p.price as product_price,
      s.name as store_name, s.address as store_address, s.lat as store_lat, s.lng as store_lng,
      s.merchant_id,
      c.name as client_name, c.phone as client_phone, c.address as client_address,
      c.lat as client_lat, c.lng as client_lng,
      d.name as driver_name, d.phone as driver_phone
    FROM missions m
    JOIN orders o ON m.order_id = o.id
    JOIN products p ON o.product_id = p.id
    JOIN stores s ON o.store_id = s.id
    JOIN users c ON o.client_id = c.id
    LEFT JOIN users d ON m.driver_id = d.id
    WHERE m.id = ?
  `).get(missionId);
}

/**
 * Le livreur est-il engagé dans une mission active (livraison en cours) ?
 * Usage : garde avant assignOrderToDriver — une offre pending n'est PAS un blocage.
 */
function driverHasAcceptedMission(driverId) {
  const row = db.prepare(`
    SELECT id FROM missions
    WHERE driver_id = ?
      AND status IN ('accepted', 'picking_up', 'picked_up', 'delivering')
    LIMIT 1
  `).get(driverId);
  return !!row;
}

/**
 * Le livreur possède-t-il une proposition de course en attente de réponse ?
 * Usage : modèle métier « offre pending » — distinct de la mission acceptée.
 */
function driverHasPendingOffer(driverId, excludeMissionId = null) {
  if (excludeMissionId) {
    const row = db.prepare(`
      SELECT id FROM missions
      WHERE offered_to_driver_id = ?
        AND status = 'offered'
        AND datetime(offer_expires_at) > datetime('now')
        AND id != ?
      LIMIT 1
    `).get(driverId, excludeMissionId);
    return !!row;
  }
  const row = db.prepare(`
    SELECT id FROM missions
    WHERE offered_to_driver_id = ?
      AND status = 'offered'
      AND datetime(offer_expires_at) > datetime('now')
    LIMIT 1
  `).get(driverId);
  return !!row;
}

/**
 * Peut-on proposer une nouvelle course à ce livreur ?
 * Règle métier dispatch : occupé si mission acceptée OU offre déjà en attente.
 */
function driverIsBusyForNewOffer(driverId) {
  return driverHasAcceptedMission(driverId) || driverHasPendingOffer(driverId);
}

/** @deprecated Préférer driverHasAcceptedMission / driverIsBusyForNewOffer selon le contexte. */
function driverHasActiveMission(driverId) {
  return driverIsBusyForNewOffer(driverId);
}

function findAvailableDriver(excludeDriverIds = []) {
  const excludes = Array.isArray(excludeDriverIds) ? excludeDriverIds : [excludeDriverIds].filter(Boolean);
  const params = [...excludes];
  const excludeSql = excludes.length
    ? `AND u.id NOT IN (${excludes.map(() => '?').join(',')})`
    : '';
  return db.prepare(`
    SELECT u.id, u.name, u.lat, u.lng
    FROM users u
    WHERE u.role = 'driver' AND u.driver_online = 1
      ${excludeSql}
      AND NOT EXISTS (
        SELECT 1 FROM missions m
        WHERE m.driver_id = u.id
          AND m.status IN ('accepted', 'picking_up', 'picked_up', 'delivering')
      )
    ORDER BY datetime(u.created_at) ASC
    LIMIT 1
  `).get(...params);
}

function getOldestPendingOrder() {
  return db.prepare(`
    SELECT o.id, o.status, m.id as mission_id
    FROM orders o
    JOIN missions m ON m.order_id = o.id
    WHERE o.status IN ('pending_driver', 'placed', 'pending', 'searching_driver', 'offered')
      AND m.driver_id IS NULL
      AND m.status = 'available'
      AND o.status NOT IN ('delivered', 'cancelled')
    ORDER BY o.created_at ASC
    LIMIT 1
  `).get();
}

function emitOrderUpdate(io, order) {
  if (!io || !order) return;
  const payload = { orderId: order.id, status: order.status, order };
  io.to(`order_${order.id}`).emit('order:status_updated', payload);
  io.to(`merchant_${order.merchant_id}`).emit('order:status_updated', payload);
  io.to(`user_${order.client_id}`).emit('order:status_updated', payload);
}

/** Attribution immédiate au premier livreur en ligne disponible */
function assignOrderToDriver(orderId, driverId, io) {
  const { txn } = require('./kernel');
  const orderEngine = require('./orders/orderEngine');

  const result = txn.run(() => {
    const order = db.prepare(`
      SELECT o.*, m.id as mission_id
      FROM orders o
      JOIN missions m ON m.order_id = o.id
      WHERE o.id = ?
        AND m.driver_id IS NULL
        AND m.status IN ('available', 'offered')
    `).get(orderId);

    if (!order) return null;
    // Acceptation d'une offre : seule une mission acceptée bloque, pas l'offre en cours.
    if (driverHasAcceptedMission(driverId)) return null;

    db.prepare(`
      UPDATE missions
      SET driver_id = ?, status = ?, accepted_at = datetime('now'),
          offered_to_driver_id = NULL, offer_expires_at = NULL,
          updated_at = datetime('now')
      WHERE id = ? AND driver_id IS NULL
        AND (
          status = 'available'
          OR (status = 'offered' AND (offered_to_driver_id IS NULL OR offered_to_driver_id = ?))
        )
    `).run(driverId, MISSION_ACTIVE, order.mission_id, driverId);

    // Le statut de la commande passe par le moteur : le dispatch décide QUI livre,
    // l'organe Orders reste seul juge de ce qu'une commande peut devenir. Une
    // transition impossible fait échouer l'affectation entière.
    orderEngine.transitionOrder(orderId, ORDER_STATUS.DRIVER_ASSIGNED, { actor: driverId });

    const full = getFullMission(order.mission_id);
    getOrCreateConversation(orderId, 'client_driver', full.client_id, driverId);
    getOrCreateConversation(orderId, 'merchant_driver', full.merchant_id, driverId);
    return full;
  });

  if (!result) return null;

  if (io) {
    // `order:status_updated` n'est plus émis ici : l'abonné au fait
    // `order.transitioned` s'en charge, une seule fois, après commit.
    io.to(`user_${driverId}`).emit('mission:assigned', { mission: result });
    io.to(`order_${result.order_id}`).emit('mission:accepted', { mission: result });
    io.to(`merchant_${result.merchant_id}`).emit('mission:accepted', { mission: result });
    io.to('drivers_available').emit('mission:taken', { missionId: result.id });
  }

  return { mission: result };
}

function assignPendingOrdersToDriver(driverId, io) {
  if (driverIsBusyForNewOffer(driverId)) return null;
  const pending = getOldestPendingOrder();
  if (!pending) return null;
  if (OFFER_MODE) {
    const { proposeOrderToDriver } = require('./dispatchOffer');
    return proposeOrderToDriver(pending.id, driverId, io);
  }
  return assignOrderToDriver(pending.id, driverId, io);
}

function tryDispatchNewOrder(orderId, io, options = {}) {
  const driver = findAvailableDriver(options.excludeDriverIds || []);
  if (!driver) return null;
  if (OFFER_MODE) {
    const { proposeOrderToDriver } = require('./dispatchOffer');
    return proposeOrderToDriver(orderId, driver.id, io);
  }
  return assignOrderToDriver(orderId, driver.id, io);
}

/**
 * Crée la mission de livraison d'une commande.
 *
 * Appelé par l'organe Orders DANS sa transaction de création. C'est ici et nulle
 * part ailleurs que naît une ligne de `missions` : le dispatch est propriétaire de
 * cette table (Loi 3), l'organe Orders la lui délègue.
 *
 * @returns {string} identifiant de la mission créée
 */
function createMissionForOrder(orderId) {
  const missionId = db.generateId();
  db.prepare("INSERT INTO missions (id, order_id, status) VALUES (?, ?, 'available')")
    .run(missionId, orderId);
  return missionId;
}

/**
 * Libère la mission d'une commande annulée : plus de livreur, plus d'offre.
 *
 * Appelé par l'organe Orders DANS sa transaction d'annulation. Ne touche NI la
 * commande NI le stock, et n'annule pas le minuteur d'offre : celui-ci vit en
 * mémoire et doit être coupé après commit, pas pendant.
 */
function releaseMissionForOrder(orderId) {
  db.prepare(`
    UPDATE missions
    SET status = 'cancelled', driver_id = NULL, offered_to_driver_id = NULL,
        offer_expires_at = NULL, updated_at = datetime('now')
    WHERE order_id = ?
  `).run(orderId);
}

module.exports = {
  createMissionForOrder,
  releaseMissionForOrder,
  driverHasAcceptedMission,
  driverHasPendingOffer,
  driverIsBusyForNewOffer,
  driverHasActiveMission,
  findAvailableDriver,
  getOldestPendingOrder,
  assignOrderToDriver,
  assignPendingOrdersToDriver,
  tryDispatchNewOrder,
  getFullMission,
  emitOrderUpdate,
};
