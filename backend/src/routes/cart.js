const express = require('express');
const db = require('../db');
const { verifyToken, requireRole } = require('../middleware/auth');
const { getActivePromotion } = require('../lib/promotions');

const router = express.Router();

function getCartItems(clientId) {
  return db.prepare(`
    SELECT ci.*,
      p.name, p.price, p.quantity as stock, p.image_url, p.active, p.store_id,
      s.name as store_name,
      pr.id as promo_id, pr.type as promo_type, pr.discount_percent,
      pr.promo_price, pr.original_price, pr.active as promo_active,
      pr.ends_at as promo_ends_at, pr.remaining_quantity as promo_remaining
    FROM cart_items ci
    JOIN products p ON ci.product_id = p.id
    JOIN stores s ON p.store_id = s.id
    LEFT JOIN promotions pr ON pr.product_id = p.id AND pr.active = 1
      AND (pr.ends_at IS NULL OR pr.ends_at > datetime('now'))
      AND (pr.remaining_quantity IS NULL OR pr.remaining_quantity > 0)
    WHERE ci.client_id = ? AND p.active = 1
    ORDER BY ci.created_at DESC
  `).all(clientId).map((row) => {
    const promo = getActivePromotion(row.product_id);
    const hasDiscount = promo?.type === 'discount' && promo.promo_price != null;
    const unitPrice = hasDiscount ? promo.promo_price : row.price;
    return {
      id: row.id,
      product_id: row.product_id,
      quantity: row.quantity,
      name: row.name,
      price: row.price,
      unit_price: unitPrice,
      promo_price: hasDiscount ? promo.promo_price : null,
      original_price: hasDiscount ? (promo.original_price || row.price) : null,
      discount_percent: hasDiscount ? promo.discount_percent : null,
      promo_label: promo?.type === 'buy_get'
        ? `${promo.get_quantity} offert(s) pour ${promo.buy_quantity}`
        : (hasDiscount ? `-${promo.discount_percent}%` : null),
      promo_type: promo?.type ?? null,
      stock: row.stock,
      image_url: row.image_url,
      store_id: row.store_id,
      store_name: row.store_name,
      line_total: unitPrice * row.quantity,
    };
  });
}

// GET /api/cart
router.get('/', verifyToken, requireRole('client'), (req, res) => {
  const items = getCartItems(req.user.id);
  const total = items.reduce((sum, i) => sum + i.line_total, 0);
  res.json({ items, total, count: items.reduce((s, i) => s + i.quantity, 0) });
});

// POST /api/cart — ajouter ou incrémenter
router.post('/', verifyToken, requireRole('client'), (req, res) => {
  const { product_id, quantity = 1 } = req.body;
  if (!product_id) return res.status(400).json({ error: 'product_id requis' });

  const product = db.prepare('SELECT * FROM products WHERE id = ? AND active = 1').get(product_id);
  if (!product) return res.status(404).json({ error: 'Produit introuvable' });

  const existing = db.prepare(
    'SELECT * FROM cart_items WHERE client_id = ? AND product_id = ?'
  ).get(req.user.id, product_id);

  const newQty = (existing?.quantity || 0) + quantity;
  if (newQty > product.quantity) {
    return res.status(400).json({ error: `Stock insuffisant (${product.quantity} disponible)` });
  }

  if (existing) {
    db.prepare('UPDATE cart_items SET quantity = ? WHERE id = ?').run(newQty, existing.id);
  } else {
    db.prepare(
      'INSERT INTO cart_items (id, client_id, product_id, quantity) VALUES (?, ?, ?, ?)'
    ).run(db.generateId(), req.user.id, product_id, quantity);
  }

  const items = getCartItems(req.user.id);
  res.json({ items, count: items.reduce((s, i) => s + i.quantity, 0) });
});

// PATCH /api/cart/:id
router.patch('/:id', verifyToken, requireRole('client'), (req, res) => {
  const { quantity } = req.body;
  if (!quantity || quantity < 1) return res.status(400).json({ error: 'quantity invalide' });

  const item = db.prepare(
    'SELECT ci.*, p.quantity as stock FROM cart_items ci JOIN products p ON ci.product_id = p.id WHERE ci.id = ? AND ci.client_id = ?'
  ).get(req.params.id, req.user.id);
  if (!item) return res.status(404).json({ error: 'Article introuvable' });
  if (quantity > item.stock) return res.status(400).json({ error: `Stock insuffisant (${item.stock})` });

  db.prepare('UPDATE cart_items SET quantity = ? WHERE id = ?').run(quantity, item.id);
  res.json({ items: getCartItems(req.user.id) });
});

// DELETE /api/cart/:id
router.delete('/:id', verifyToken, requireRole('client'), (req, res) => {
  db.prepare('DELETE FROM cart_items WHERE id = ? AND client_id = ?').run(req.params.id, req.user.id);
  res.json({ items: getCartItems(req.user.id) });
});

// DELETE /api/cart — vider le panier
router.delete('/', verifyToken, requireRole('client'), (req, res) => {
  db.prepare('DELETE FROM cart_items WHERE client_id = ?').run(req.user.id);
  res.json({ items: [] });
});

module.exports = router;
