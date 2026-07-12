const db = require('../db');

const TERMINAL_ORDER_STATUSES = ['delivered', 'cancelled'];

const KIND_LABEL = {
  client_merchant: 'Client ↔ Commerçant',
  client_driver: 'Client ↔ Livreur',
  merchant_driver: 'Commerçant ↔ Livreur',
  support: 'Assistance Ma Zone',
  system: 'Système',
};

function resolveParticipantMode(kind) {
  if (kind === 'client_merchant') return 'store_team';
  return 'dyadic';
}

function resolveLifecycle(kind) {
  if (kind === 'client_merchant' || kind === 'support' || kind === 'system') return 'durable';
  return 'ephemeral';
}

function getStoreIdsForUser(userId) {
  return db
    .prepare('SELECT store_id FROM store_members WHERE user_id = ?')
    .all(userId)
    .map((r) => r.store_id);
}

function isStoreMember(userId, storeId) {
  if (!storeId) return false;
  return !!db
    .prepare('SELECT 1 FROM store_members WHERE store_id = ? AND user_id = ?')
    .get(storeId, userId);
}

function canAccessThread(userId, conv) {
  if (!conv) return false;
  if (conv.user_a === userId || conv.user_b === userId) return true;
  if (conv.participant_mode === 'store_team' && conv.store_id) {
    return isStoreMember(userId, conv.store_id);
  }
  if (conv.kind === 'merchant_driver' && conv.order_id) {
    const order = db.prepare('SELECT store_id FROM orders WHERE id = ?').get(conv.order_id);
    return order && isStoreMember(userId, order.store_id);
  }
  return false;
}

function isOrderActive(orderId) {
  const order = db.prepare('SELECT status FROM orders WHERE id = ?').get(orderId);
  return order && !TERMINAL_ORDER_STATUSES.includes(order.status);
}

function isThreadVisibleToUser(userId, role, conv) {
  if (!canAccessThread(userId, conv)) return false;
  if (conv.status === 'archived') return false;

  if (conv.lifecycle === 'ephemeral') {
    if (!conv.order_id) return false;
    if (!isOrderActive(conv.order_id)) return false;
    if (role === 'driver' && conv.kind === 'client_driver') {
      return conv.user_a === userId || conv.user_b === userId;
    }
  }

  if (conv.kind === 'support') {
    return conv.user_a === userId || conv.user_b === userId;
  }

  return true;
}

function getOrderContext(orderId) {
  return db
    .prepare(
      `SELECT o.id, o.client_id, o.store_id, o.status, s.merchant_id, m.driver_id
       FROM orders o
       JOIN stores s ON o.store_id = s.id
       LEFT JOIN missions m ON m.order_id = o.id
       WHERE o.id = ?`
    )
    .get(orderId);
}

function resolveKind(myRole, targetRole) {
  const pair = [myRole, targetRole].sort().join('_');
  const kindMap = {
    client_merchant: 'client_merchant',
    client_driver: 'client_driver',
    driver_merchant: 'merchant_driver',
  };
  return kindMap[pair] || null;
}

function findDurableClientMerchant(clientId, storeId) {
  return db
    .prepare(
      `SELECT * FROM conversations
       WHERE kind = 'client_merchant' AND store_id = ? AND user_a = ? AND lifecycle = 'durable'
       LIMIT 1`
    )
    .get(storeId, clientId);
}

function findEphemeralByOrder(orderId, kind) {
  return db
    .prepare(
      `SELECT * FROM conversations
       WHERE order_id = ? AND kind = ? AND lifecycle = 'ephemeral'
       LIMIT 1`
    )
    .get(orderId, kind);
}

function archiveEphemeralForOrder(orderId) {
  db.prepare(
    `UPDATE conversations SET status = 'archived', updated_at = datetime('now')
     WHERE order_id = ? AND lifecycle = 'ephemeral' AND status = 'active'`
  ).run(orderId);
}

function getVisibleThreadRows(userId, role, filters = {}) {
  let rows = [];

  if (role === 'client') {
    rows = db
      .prepare(
        `SELECT * FROM conversations
         WHERE user_a = ? AND kind = 'client_merchant' AND lifecycle = 'durable' AND status = 'active'`
      )
      .all(userId);
    if (filters.kind) rows = rows.filter((r) => r.kind === filters.kind);
    if (filters.lifecycle) rows = rows.filter((r) => r.lifecycle === filters.lifecycle);
    return rows;
  }

  if (role === 'merchant') {
    const storeIds = getStoreIdsForUser(userId);
    if (storeIds.length === 0) return [];
    const placeholders = storeIds.map(() => '?').join(',');
    rows = db
      .prepare(
        `SELECT * FROM conversations
         WHERE store_id IN (${placeholders}) AND status = 'active'`
      )
      .all(...storeIds);
    rows = rows.filter((r) => isThreadVisibleToUser(userId, role, r));
    if (filters.kind) rows = rows.filter((r) => r.kind === filters.kind);
    if (filters.lifecycle) rows = rows.filter((r) => r.lifecycle === filters.lifecycle);
    return rows;
  }

  if (role === 'driver') {
    rows = db
      .prepare(`SELECT * FROM conversations WHERE (user_a = ? OR user_b = ?) AND status = 'active'`)
      .all(userId, userId);
    rows = rows.filter((r) => isThreadVisibleToUser(userId, role, r));
    return rows;
  }

  rows = db
    .prepare(`SELECT * FROM conversations WHERE user_a = ? OR user_b = ?`)
    .all(userId, userId);
  return rows.filter((r) => isThreadVisibleToUser(userId, role, r));
}

module.exports = {
  KIND_LABEL,
  TERMINAL_ORDER_STATUSES,
  resolveParticipantMode,
  resolveLifecycle,
  getStoreIdsForUser,
  isStoreMember,
  canAccessThread,
  isThreadVisibleToUser,
  isOrderActive,
  getOrderContext,
  resolveKind,
  findDurableClientMerchant,
  findEphemeralByOrder,
  archiveEphemeralForOrder,
  getVisibleThreadRows,
};
