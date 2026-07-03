const express = require('express');
const db = require('../db');
const { verifyToken, requireRole } = require('../middleware/auth');
const { distanceKm } = require('../lib/geo');
const {
  expirePromotions,
  formatPromotion,
  formatFlashPromotion,
  deactivateProductPromotions,
  getActivePromotion,
} = require('../lib/promotions');

const router = express.Router();

// GET /api/promotions/flash — toutes les promotions actives côté client
router.get('/flash', verifyToken, (req, res) => {
  expirePromotions();
  const user = db.prepare('SELECT lat, lng FROM users WHERE id = ?').get(req.user.id);

  const promos = db.prepare(`
    SELECT pr.*,
      p.name as product_name, p.description as product_description,
      p.image_url as product_image, p.quantity as product_stock, p.price as product_price,
      s.name as store_name, s.address as store_address, s.lat as store_lat, s.lng as store_lng, s.id as store_id
    FROM promotions pr
    JOIN products p ON pr.product_id = p.id
    JOIN stores s ON pr.store_id = s.id
    WHERE pr.active = 1 AND p.active = 1 AND p.quantity > 0
      AND (pr.ends_at IS NULL OR pr.ends_at > datetime('now'))
      AND (pr.remaining_quantity IS NULL OR pr.remaining_quantity > 0)
    ORDER BY pr.created_at DESC
  `).all().map((row) => {
    const dist = (user?.lat && user?.lng && row.store_lat && row.store_lng)
      ? Math.round(distanceKm(user.lat, user.lng, row.store_lat, row.store_lng) * 10) / 10
      : null;
    return formatFlashPromotion({ ...row, distance_km: dist });
  }).filter(Boolean);

  res.json({ promotions: promos });
});

// GET /api/promotions/mine — commerçant (actives + terminées)
router.get('/mine', verifyToken, requireRole('merchant'), (req, res) => {
  expirePromotions();
  const store = db.prepare('SELECT id FROM stores WHERE merchant_id = ?').get(req.user.id);
  if (!store) return res.json({ promotions: [], active: [], ended: [] });

  const rows = db.prepare(`
    SELECT pr.*, p.name as product_name, p.image_url as product_image, p.quantity as product_stock, p.price as product_price
    FROM promotions pr
    JOIN products p ON pr.product_id = p.id
    WHERE pr.store_id = ?
    ORDER BY pr.created_at DESC
  `).all(store.id).map(formatPromotion);

  const active = rows.filter((p) => p.status === 'active');
  const ended = rows.filter((p) => p.status === 'ended');

  res.json({ promotions: rows, active, ended });
});

// POST /api/promotions
router.post('/', verifyToken, requireRole('merchant'), (req, res) => {
  const store = db.prepare('SELECT id FROM stores WHERE merchant_id = ?').get(req.user.id);
  if (!store) return res.status(400).json({ error: 'Créez d\'abord votre boutique' });

  const {
    product_id, type, discount_percent, buy_quantity, get_quantity,
    max_quantity, ends_at,
  } = req.body;

  if (!product_id || !type) return res.status(400).json({ error: 'product_id et type requis' });
  if (!['discount', 'buy_get'].includes(type)) return res.status(400).json({ error: 'type invalide' });

  const product = db.prepare(
    'SELECT * FROM products WHERE id = ? AND store_id = ? AND active = 1'
  ).get(product_id, store.id);
  if (!product) return res.status(404).json({ error: 'Produit introuvable' });

  // Une seule promotion active par produit
  deactivateProductPromotions(product_id);

  const id = db.generateId();
  let promo_price = null;
  const original_price = product.price;
  let pct = null;

  if (type === 'discount') {
    pct = parseFloat(discount_percent);
    if (!pct || pct <= 0 || pct >= 100) return res.status(400).json({ error: 'Pourcentage invalide (1-99)' });
    promo_price = Math.round(product.price * (1 - pct / 100) * 100) / 100;
  } else {
    const buy = parseInt(buy_quantity, 10);
    const get = parseInt(get_quantity, 10);
    if (!buy || !get || buy < 1 || get < 1) return res.status(400).json({ error: 'Quantités requises (min 1)' });
  }

  const maxQty = max_quantity ? parseInt(max_quantity, 10) : null;
  const endsAtFormatted = ends_at ? ends_at.replace('T', ' ').trim() : null;

  db.prepare(`
    INSERT INTO promotions (
      id, store_id, product_id, type, discount_percent, promo_price, original_price,
      buy_quantity, get_quantity, max_quantity, remaining_quantity, ends_at, active
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
  `).run(
    id, store.id, product_id, type, pct, promo_price, original_price,
    buy_quantity ? parseInt(buy_quantity, 10) : null,
    get_quantity ? parseInt(get_quantity, 10) : null,
    maxQty, maxQty, endsAtFormatted,
  );

  const promo = db.prepare(`
    SELECT pr.*, p.name as product_name, p.image_url as product_image
    FROM promotions pr JOIN products p ON pr.product_id = p.id WHERE pr.id = ?
  `).get(id);

  const formatted = formatPromotion(promo);
  const io = req.app.get('io');
  io.emit('promotion:created', { promotion: formatted });
  io.emit('promotion:updated', { promotion: formatted });

  res.status(201).json({ promotion: formatted });
});

// PATCH /api/promotions/:id
router.patch('/:id', verifyToken, requireRole('merchant'), (req, res) => {
  expirePromotions();
  const store = db.prepare('SELECT id FROM stores WHERE merchant_id = ?').get(req.user.id);
  if (!store) return res.status(400).json({ error: 'Boutique introuvable' });

  const promo = db.prepare('SELECT * FROM promotions WHERE id = ? AND store_id = ?').get(req.params.id, store.id);
  if (!promo) return res.status(404).json({ error: 'Promotion introuvable' });

  const { discount_percent, max_quantity, remaining_quantity, ends_at, active } = req.body;
  const product = db.prepare('SELECT price FROM products WHERE id = ?').get(promo.product_id);

  let promo_price = promo.promo_price;
  let pct = promo.discount_percent;

  if (discount_percent != null && promo.type === 'discount') {
    pct = parseFloat(discount_percent);
    promo_price = Math.round(product.price * (1 - pct / 100) * 100) / 100;
  }

  const endsAtFormatted = ends_at != null ? (ends_at ? ends_at.replace('T', ' ').trim() : null) : promo.ends_at;

  db.prepare(`
    UPDATE promotions SET
      discount_percent = ?, promo_price = ?, original_price = ?,
      max_quantity = COALESCE(?, max_quantity),
      remaining_quantity = COALESCE(?, remaining_quantity),
      ends_at = COALESCE(?, ends_at),
      active = COALESCE(?, active)
    WHERE id = ?
  `).run(
    pct, promo_price, product.price,
    max_quantity != null ? parseInt(max_quantity, 10) : null,
    remaining_quantity != null ? parseInt(remaining_quantity, 10) : null,
    endsAtFormatted,
    active != null ? (active ? 1 : 0) : null,
    promo.id,
  );

  expirePromotions();

  const updated = db.prepare(`
    SELECT pr.*, p.name as product_name, p.image_url as product_image
    FROM promotions pr JOIN products p ON pr.product_id = p.id WHERE pr.id = ?
  `).get(promo.id);

  const formatted = formatPromotion(updated);
  req.app.get('io').emit('promotion:updated', { promotion: formatted });
  res.json({ promotion: formatted });
});

// DELETE /api/promotions/:id
router.delete('/:id', verifyToken, requireRole('merchant'), (req, res) => {
  const store = db.prepare('SELECT id FROM stores WHERE merchant_id = ?').get(req.user.id);
  const promo = db.prepare('SELECT * FROM promotions WHERE id = ? AND store_id = ?').get(req.params.id, store?.id);
  if (!promo) return res.status(404).json({ error: 'Promotion introuvable' });

  db.prepare('UPDATE promotions SET active = 0 WHERE id = ?').run(promo.id);
  db.prepare('DELETE FROM promotions WHERE id = ?').run(promo.id);

  req.app.get('io').emit('promotion:deleted', { id: promo.id, product_id: promo.product_id });
  res.json({ success: true });
});

module.exports = router;
