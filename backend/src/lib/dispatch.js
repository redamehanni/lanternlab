const db = require('../db');
const { ORDER_STATUS, canClientCancel } = require('./orderStatus');
const { getFullOrder } = require('./orders');
const { getOrCreateConversation } = require('./conversations');

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

function driverHasActiveMission(driverId) {
  const row = db.prepare(`
    SELECT id FROM missions
    WHERE driver_id = ?
      AND status IN ('accepted', 'picking_up', 'picked_up', 'delivering')
    LIMIT 1
  `).get(driverId);
  return !!row;
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
  const result = db.transaction(() => {
    const order = db.prepare(`
      SELECT o.*, m.id as mission_id
      FROM orders o
      JOIN missions m ON m.order_id = o.id
      WHERE o.id = ?
        AND m.driver_id IS NULL
        AND m.status = 'available'
    `).get(orderId);

    if (!order) return null;
    if (driverHasActiveMission(driverId)) return null;

    db.prepare(`
      UPDATE missions
      SET driver_id = ?, status = ?, accepted_at = datetime('now'), updated_at = datetime('now')
      WHERE id = ? AND driver_id IS NULL AND status = 'available'
    `).run(driverId, MISSION_ACTIVE, order.mission_id);

    db.prepare(`
      UPDATE orders SET status = ?, updated_at = datetime('now') WHERE id = ?
    `).run(ORDER_STATUS.DRIVER_ASSIGNED, orderId);

    const full = getFullMission(order.mission_id);
    getOrCreateConversation(orderId, 'client_driver', full.client_id, driverId);
    getOrCreateConversation(orderId, 'merchant_driver', full.merchant_id, driverId);
    return full;
  })();

  if (!result) return null;

  if (io) {
    const order = getFullOrder(orderId);
    emitOrderUpdate(io, order);
    io.to(`user_${driverId}`).emit('mission:assigned', { mission: result });
    io.to(`order_${result.order_id}`).emit('mission:accepted', { mission: result });
    io.to(`merchant_${result.merchant_id}`).emit('mission:accepted', { mission: result });
    io.to('drivers_available').emit('mission:taken', { missionId: result.id });
  }

  return { mission: result };
}

function assignPendingOrdersToDriver(driverId, io) {
  if (driverHasActiveMission(driverId)) return null;
  const pending = getOldestPendingOrder();
  if (!pending) return null;
  return assignOrderToDriver(pending.id, driverId, io);
}

function tryDispatchNewOrder(orderId, io) {
  const driver = findAvailableDriver();
  if (!driver) return null;
  return assignOrderToDriver(orderId, driver.id, io);
}

function createOrderWithDispatch({
  orderId, clientId, productId, storeId, quantity, totalPrice, deliveryAddress, estimatedMinutes,
}) {
  const missionId = db.generateId();
  db.transaction(() => {
    db.prepare(`
      INSERT INTO orders (id, client_id, product_id, store_id, quantity, total_price, status, delivery_address, estimated_minutes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      orderId, clientId, productId, storeId, quantity, totalPrice,
      ORDER_STATUS.PENDING_DRIVER, deliveryAddress, estimatedMinutes,
    );
    db.prepare(`INSERT INTO missions (id, order_id, status) VALUES (?, ?, 'available')`).run(missionId, orderId);
  })();
  return {
    order: getFullOrder(orderId),
    mission: db.prepare('SELECT * FROM missions WHERE id = ?').get(missionId),
    missionId,
  };
}

function cancelOrderByClient(orderId, clientId, io) {
  const row = db.prepare(`
    SELECT o.*, m.id as mission_id, m.driver_id, m.status as mission_status, p.quantity as product_stock
    FROM orders o
    JOIN missions m ON m.order_id = o.id
    JOIN products p ON o.product_id = p.id
    WHERE o.id = ? AND o.client_id = ?
  `).get(orderId, clientId);

  if (!row) return { error: 'Commande introuvable', status: 404 };
  if (!canClientCancel(row.status)) {
    return { error: 'Cette commande ne peut plus être annulée.', status: 409 };
  }

  const driverId = row.driver_id;
  db.transaction(() => {
    db.prepare(`UPDATE orders SET status = ?, updated_at = datetime('now') WHERE id = ?`)
      .run(ORDER_STATUS.CANCELLED, orderId);
    db.prepare(`UPDATE missions SET status = 'cancelled', updated_at = datetime('now') WHERE order_id = ?`)
      .run(orderId);
    db.prepare(`UPDATE products SET quantity = quantity + ? WHERE id = ?`)
      .run(row.quantity, row.product_id);
  })();

  const order = getFullOrder(orderId);

  if (io) {
    emitOrderUpdate(io, order);
    io.to(`order_${orderId}`).emit('order:cancelled', { orderId, order });
    io.to(`merchant_${order.merchant_id}`).emit('order:cancelled', { orderId, order });
    if (driverId) {
      io.to(`user_${driverId}`).emit('mission:cancelled', { missionId: row.mission_id, orderId, order });
    }
    io.emit('product:stock_updated', {
      productId: row.product_id,
      quantity: row.product_stock + row.quantity,
      storeId: row.store_id,
    });
  }
  return { order };
}

module.exports = {
  driverHasActiveMission,
  findAvailableDriver,
  getOldestPendingOrder,
  assignOrderToDriver,
  assignPendingOrdersToDriver,
  tryDispatchNewOrder,
  createOrderWithDispatch,
  cancelOrderByClient,
  getFullMission,
  emitOrderUpdate,
};
