/**
 * Orchestration — adaptateur des notifications commerçant.
 *
 * Une notification n'est jamais compensable : on ne « dé-informe » personne. Les
 * étapes de ce fichier n'ont donc pas de compensation, et c'est pour cela qu'elles
 * sont placées en FIN de plan — après elles, plus rien ne peut échouer utilement.
 */

const db = require('../../../db');
const { createMerchantNotification } = require('../../merchantNotifications');

/** Informe le commerçant qu'une unité a été mise de côté pour un client. */
function notifyReservation(params, ctx) {
  const product = db
    .prepare('SELECT p.name, s.merchant_id FROM products p JOIN stores s ON p.store_id = s.id WHERE p.id = ?')
    .get(params.productId);
  if (!product) return { notified: 0 };

  createMerchantNotification(
    product.merchant_id,
    'Article mis de côté',
    `${params.quantity} × ${product.name} réservé${params.quantity > 1 ? 's' : ''}.`,
    'stock_reserved'
  );
  ctx.io?.to(`merchant_${product.merchant_id}`).emit('stock:reserved', {
    productId: params.productId,
    quantity: params.quantity,
  });
  return { notified: 1, merchantId: product.merchant_id };
}

/** Prévient les clients ayant une commande en cours dans une boutique qui ferme. */
function notifyOpenOrders(params, ctx) {
  const clients = db.prepare(`
    SELECT DISTINCT o.client_id, o.id AS order_id
    FROM orders o
    WHERE o.store_id = ? AND o.status NOT IN ('delivered', 'cancelled')
  `).all(params.storeId);

  for (const row of clients) {
    ctx.io?.to(`user_${row.client_id}`).emit('store:closed_exceptionally', {
      storeId: params.storeId,
      orderId: row.order_id,
      reason: params.reason || null,
    });
  }

  return { notified: clients.length };
}

module.exports = { notifyReservation, notifyOpenOrders };
