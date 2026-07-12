const express = require('express');
const db = require('../db');
const { verifyToken, requireRole } = require('../middleware/auth');
const { estimateDeliveryMinutes } = require('../lib/geo');
const { getOrCreateConversation } = require('../lib/conversations');
const { getEffectivePrice, consumePromoStock } = require('../lib/promotions');
const { createMerchantNotification } = require('../lib/merchantNotifications');
const { getFullOrder } = require('../lib/orders');
const {
  createOrderWithDispatch,
  tryDispatchNewOrder,
  cancelOrderByClient,
  emitOrderUpdate,
} = require('../lib/dispatch');
const { ORDER_STATUS, canClientCancel } = require('../lib/orderStatus');

const router = express.Router();

function notifyMerchantNewOrder(io, order) {
  io.to(`merchant_${order.merchant_id}`).emit('order:new', { order });
  createMerchantNotification(
    order.merchant_id,
    'Nouvelle commande',
    `${order.product_name} — ${order.client_name} (${order.total_price?.toFixed(2)} €)`,
    'order_new',
  );
}

// POST /api/orders/cart — valider le panier (plusieurs articles)
router.post('/cart', verifyToken, requireRole('client'), (req, res) => {
  const { delivery_address, delivery_lat, delivery_lng } = req.body;
  const items = db.prepare(`
    SELECT ci.*, p.price, p.quantity as stock, p.store_id, p.name as product_name
    FROM cart_items ci
    JOIN products p ON ci.product_id = p.id
    WHERE ci.client_id = ? AND p.active = 1
  `).all(req.user.id);

  if (!items.length) return res.status(400).json({ error: 'Panier vide' });

  const client = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  const addr = delivery_address || client.address || '';
  const createdOrders = [];
  const io = req.app.get('io');

  const createOne = db.transaction((item) => {
    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(item.product_id);
    if (!product || product.quantity < item.quantity) {
      throw new Error(`Stock insuffisant pour ${item.product_name}`);
    }

    const unitPrice = getEffectivePrice(product);
    const store = db.prepare('SELECT * FROM stores WHERE id = ?').get(product.store_id);
    const orderId = db.generateId();
    const totalPrice = unitPrice * item.quantity;
    const estimatedMinutes = estimateDeliveryMinutes({
      storeLat: store?.lat, storeLng: store?.lng,
      clientLat: delivery_lat ?? client.lat,
      clientLng: delivery_lng ?? client.lng,
    });

    db.prepare('UPDATE products SET quantity = quantity - ? WHERE id = ?').run(item.quantity, item.product_id);
    consumePromoStock(item.product_id, item.quantity);
    io.emit('promotion:updated', { product_id: item.product_id });

    const { order, mission } = createOrderWithDispatch({
      orderId,
      clientId: req.user.id,
      productId: item.product_id,
      storeId: product.store_id,
      quantity: item.quantity,
      totalPrice,
      deliveryAddress: addr,
      estimatedMinutes,
      io,
    });

    getOrCreateConversation(orderId, 'client_merchant', req.user.id, store.merchant_id);
    notifyMerchantNewOrder(io, order);

    tryDispatchNewOrder(orderId, io);

    io.emit('product:stock_updated', {
      productId: item.product_id,
      quantity: product.quantity - item.quantity,
      storeId: product.store_id,
    });

    createdOrders.push(getFullOrder(orderId));
  });

  try {
    for (const item of items) createOne(item);
    db.prepare('DELETE FROM cart_items WHERE client_id = ?').run(req.user.id);
    res.status(201).json({ orders: createdOrders });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// POST /api/orders — le client passe commande
router.post('/', verifyToken, requireRole('client'), (req, res) => {
  const { product_id, quantity = 1, delivery_address } = req.body;
  if (!product_id) return res.status(400).json({ error: 'product_id requis' });

  const product = db.prepare('SELECT * FROM products WHERE id = ? AND active = 1').get(product_id);
  if (!product) return res.status(404).json({ error: 'Produit introuvable' });
  if (product.quantity < quantity) return res.status(400).json({ error: `Stock insuffisant (${product.quantity} disponible)` });

  const client = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  const store = db.prepare('SELECT * FROM stores WHERE id = ?').get(product.store_id);
  const { delivery_lat, delivery_lng } = req.body;

  const orderId = db.generateId();
  const unitPrice = getEffectivePrice(product);
  const totalPrice = unitPrice * quantity;
  const addr = delivery_address || client.address || '';

  const clientLat = delivery_lat ?? client.lat;
  const clientLng = delivery_lng ?? client.lng;
  const estimatedMinutes = estimateDeliveryMinutes({
    storeLat: store?.lat, storeLng: store?.lng,
    clientLat, clientLng,
  });

  db.prepare('UPDATE products SET quantity = quantity - ? WHERE id = ?').run(quantity, product_id);
  consumePromoStock(product_id, quantity);

  const io = req.app.get('io');

  const { order, mission } = createOrderWithDispatch({
    orderId,
    clientId: req.user.id,
    productId: product_id,
    storeId: product.store_id,
    quantity,
    totalPrice,
    deliveryAddress: addr,
    estimatedMinutes,
    io,
  });

  getOrCreateConversation(orderId, 'client_merchant', req.user.id, store.merchant_id);
  notifyMerchantNewOrder(io, order);

  const assigned = tryDispatchNewOrder(orderId, io);

  io.emit('product:stock_updated', {
    productId: product_id,
    quantity: product.quantity - quantity,
    storeId: product.store_id,
  });

  const dispatchStatus = assigned?.offer ? 'offered' : (assigned?.mission ? 'assigned' : 'pending_driver');

  res.status(201).json({
    order: getFullOrder(orderId),
    mission: assigned?.mission || mission,
    dispatch: dispatchStatus,
  });
});

// GET /api/orders/mine — commandes du client connecté
router.get('/mine', verifyToken, requireRole('client'), (req, res) => {
  const orders = db.prepare(`
    SELECT o.*,
      p.name as product_name, p.image_url as product_image,
      s.name as store_name, s.address as store_address,
      m.id as mission_id, m.status as mission_status, m.driver_id,
      d.name as driver_name, d.phone as driver_phone
    FROM orders o
    JOIN products p ON o.product_id = p.id
    JOIN stores s ON o.store_id = s.id
    LEFT JOIN missions m ON m.order_id = o.id
    LEFT JOIN users d ON m.driver_id = d.id
    WHERE o.client_id = ?
    ORDER BY o.created_at DESC
  `).all(req.user.id);
  res.json({ orders });
});

// GET /api/orders/merchant — commandes de la boutique du commerçant
router.get('/merchant', verifyToken, requireRole('merchant'), (req, res) => {
  const store = db.prepare('SELECT * FROM stores WHERE merchant_id = ?').get(req.user.id);
  if (!store) return res.json({ orders: [] });

  const orders = db.prepare(`
    SELECT o.*,
      u.name as client_name, u.phone as client_phone,
      p.name as product_name, p.image_url as product_image,
      m.id as mission_id, m.status as mission_status,
      d.name as driver_name
    FROM orders o
    JOIN users u ON o.client_id = u.id
    JOIN products p ON o.product_id = p.id
    LEFT JOIN missions m ON m.order_id = o.id
    LEFT JOIN users d ON m.driver_id = d.id
    WHERE o.store_id = ?
    ORDER BY o.created_at DESC
  `).all(store.id);
  res.json({ orders });
});

// GET /api/orders/:id
router.get('/:id', verifyToken, (req, res) => {
  const order = getFullOrder(req.params.id);
  if (!order) return res.status(404).json({ error: 'Commande introuvable' });
  res.json({ order, cancellable: canClientCancel(order.status) });
});

// POST /api/orders/:id/cancel — annulation client (avant prise en charge produit)
router.post('/:id/cancel', verifyToken, requireRole('client'), (req, res) => {
  const io = req.app.get('io');
  const result = cancelOrderByClient(req.params.id, req.user.id, io);
  if (result.error) return res.status(result.status).json({ error: result.error });
  res.json({ order: result.order });
});

// PATCH /api/orders/:id/status — changer le statut (commerçant ou livreur)
router.patch('/:id/status', verifyToken, (req, res) => {
  const { status } = req.body;
  const valid = [
    ORDER_STATUS.PLACED, ORDER_STATUS.PENDING_DRIVER, ORDER_STATUS.DRIVER_ASSIGNED,
    ORDER_STATUS.PICKING_UP, ORDER_STATUS.PICKED_UP, ORDER_STATUS.DELIVERING,
    ORDER_STATUS.DELIVERED, ORDER_STATUS.CANCELLED,
    'pending', 'accepted',
  ];
  if (!valid.includes(status)) return res.status(400).json({ error: 'Statut invalide' });

  const order = getFullOrder(req.params.id);
  if (!order) return res.status(404).json({ error: 'Commande introuvable' });

  db.prepare("UPDATE orders SET status = ?, updated_at = datetime('now') WHERE id = ?").run(status, order.id);

  const updatedOrder = getFullOrder(order.id);
  const io = req.app.get('io');
  emitOrderUpdate(io, updatedOrder);

  res.json({ order: updatedOrder });
});

module.exports = router;
