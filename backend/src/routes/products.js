const express = require('express');
const multer = require('multer');
const path = require('path');
const db = require('../db');
const { verifyToken, requireRole } = require('../middleware/auth');
const { enrichProductWithPromo } = require('../lib/promotions');

const router = express.Router();

const storage = multer.diskStorage({
  destination: path.join(__dirname, '../../uploads'),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname.replace(/\s/g, '_')}`),
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

// Distance Haversine en km
function distance(lat1, lng1, lat2, lng2) {
  if (!lat1 || !lng1 || !lat2 || !lng2) return null;
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// GET /api/products/search?q=term — recherche globale (tous les produits disponibles)
router.get('/search', verifyToken, (req, res) => {
  const q = `%${req.query.q || ''}%`;
  const userRow = db.prepare('SELECT lat, lng FROM users WHERE id = ?').get(req.user.id);

  const rows = db.prepare(`
    SELECT p.*, s.name as store_name, s.address as store_address, s.lat as store_lat, s.lng as store_lng, s.id as store_id
    FROM products p
    JOIN stores s ON p.store_id = s.id
    WHERE (p.name LIKE ? OR p.category LIKE ? OR p.description LIKE ?)
      AND p.active = 1
      AND p.quantity > 0
    ORDER BY p.created_at DESC
    LIMIT 50
  `).all(q, q, q);

  const results = rows.map(p => {
    const dist = distance(userRow?.lat, userRow?.lng, p.store_lat, p.store_lng);
    return {
      id: p.id,
      name: p.name,
      description: p.description,
      price: p.price,
      quantity: p.quantity,
      category: p.category,
      image_url: p.image_url,
      barcode: p.barcode,
      store: { id: p.store_id, name: p.store_name, address: p.store_address, lat: p.store_lat, lng: p.store_lng },
      distance_km: dist ? Math.round(dist * 10) / 10 : null,
      ...(() => {
        const enriched = enrichProductWithPromo({ id: p.id, price: p.price });
        return {
          promo_price: enriched.promo_price,
          original_price: enriched.original_price,
          discount_percent: enriched.discount_percent,
          promo_label: enriched.promo_label,
          promo_type: enriched.promo_type,
          promotion: enriched.promotion,
        };
      })(),
    };
  });

  res.json({ products: results });
});

// GET /api/products?storeId=xxx — produits d'une boutique
router.get('/', verifyToken, (req, res) => {
  const { storeId } = req.query;
  if (!storeId) return res.status(400).json({ error: 'storeId requis' });

  const rows = db.prepare('SELECT * FROM products WHERE store_id = ? AND active = 1 ORDER BY created_at DESC').all(storeId);
  res.json({ products: rows.map((p) => enrichProductWithPromo(p)) });
});

// GET /api/products/:id
router.get('/:id', verifyToken, (req, res) => {
  const p = db.prepare(`
    SELECT p.*, s.name as store_name, s.address as store_address, s.lat as store_lat, s.lng as store_lng
    FROM products p JOIN stores s ON p.store_id = s.id
    WHERE p.id = ?
  `).get(req.params.id);
  if (!p) return res.status(404).json({ error: 'Produit introuvable' });
  res.json({ product: enrichProductWithPromo(p) });
});

// POST /api/products — créer un produit (commerçant)
router.post('/', verifyToken, requireRole('merchant'), upload.single('image'), (req, res) => {
  const store = db.prepare('SELECT * FROM stores WHERE merchant_id = ?').get(req.user.id);
  if (!store) return res.status(400).json({ error: 'Créez d\'abord votre boutique' });

  const { name, description, price, quantity, category, barcode } = req.body;
  if (!name || !price) return res.status(400).json({ error: 'name et price requis' });

  const id = db.generateId();
  const image_url = req.file ? `/uploads/${req.file.filename}` : null;

  db.prepare(`
    INSERT INTO products (id, store_id, name, description, price, quantity, category, image_url, barcode)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, store.id, name, description || null, parseFloat(price), parseInt(quantity) || 0, category || null, image_url, barcode || null);

  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
  req.app.get('io').emit('product:created', { product, store });
  res.status(201).json({ product });
});

// PATCH /api/products/:id/stock — modifier le stock
router.patch('/:id/stock', verifyToken, requireRole('merchant'), (req, res) => {
  const { quantity, delta } = req.body;
  const p = db.prepare(`
    SELECT p.* FROM products p JOIN stores s ON p.store_id = s.id
    WHERE p.id = ? AND s.merchant_id = ?
  `).get(req.params.id, req.user.id);
  if (!p) return res.status(404).json({ error: 'Produit introuvable' });

  let newQty;
  if (typeof quantity === 'number') {
    newQty = Math.max(0, quantity);
  } else if (typeof delta === 'number') {
    newQty = Math.max(0, p.quantity + delta);
  } else {
    return res.status(400).json({ error: 'quantity ou delta requis' });
  }

  db.prepare('UPDATE products SET quantity = ? WHERE id = ?').run(newQty, p.id);
  const updated = db.prepare('SELECT * FROM products WHERE id = ?').get(p.id);

  req.app.get('io').emit('product:stock_updated', { productId: p.id, quantity: newQty, storeId: p.store_id });
  res.json({ product: updated });
});

// PUT /api/products/:id — modifier les infos du produit
router.put('/:id', verifyToken, requireRole('merchant'), upload.single('image'), (req, res) => {
  const p = db.prepare(`
    SELECT p.* FROM products p JOIN stores s ON p.store_id = s.id
    WHERE p.id = ? AND s.merchant_id = ?
  `).get(req.params.id, req.user.id);
  if (!p) return res.status(404).json({ error: 'Produit introuvable' });

  const { name, description, price, quantity, category, barcode } = req.body;
  const image_url = req.file ? `/uploads/${req.file.filename}` : p.image_url;

  db.prepare(`
    UPDATE products SET name=?, description=?, price=?, quantity=?, category=?, image_url=?, barcode=? WHERE id=?
  `).run(
    name || p.name,
    description ?? p.description,
    price ? parseFloat(price) : p.price,
    quantity !== undefined ? parseInt(quantity) : p.quantity,
    category ?? p.category,
    image_url,
    barcode ?? p.barcode,
    p.id
  );

  const updated = db.prepare('SELECT * FROM products WHERE id = ?').get(p.id);
  req.app.get('io').emit('product:updated', { product: updated });
  res.json({ product: updated });
});

// DELETE /api/products/:id — désactiver
router.delete('/:id', verifyToken, requireRole('merchant'), (req, res) => {
  const p = db.prepare(`
    SELECT p.* FROM products p JOIN stores s ON p.store_id = s.id
    WHERE p.id = ? AND s.merchant_id = ?
  `).get(req.params.id, req.user.id);
  if (!p) return res.status(404).json({ error: 'Produit introuvable' });

  db.prepare('UPDATE products SET active = 0 WHERE id = ?').run(p.id);
  req.app.get('io').emit('product:deleted', { productId: p.id, storeId: p.store_id });
  res.json({ success: true });
});

module.exports = router;
