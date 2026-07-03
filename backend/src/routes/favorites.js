const express = require('express');
const db = require('../db');
const { verifyToken, requireRole } = require('../middleware/auth');
const { distanceKm } = require('../lib/geo');

const router = express.Router();

function enrichStore(store, userLat, userLng) {
  const dist = (userLat && userLng && store.lat && store.lng)
    ? distanceKm(userLat, userLng, store.lat, store.lng)
    : null;
  return {
    ...store,
    distance_km: dist != null ? Math.round(dist * 10) / 10 : null,
    product_count: db.prepare(
      'SELECT COUNT(*) as c FROM products WHERE store_id = ? AND active = 1 AND quantity > 0'
    ).get(store.id).c,
  };
}

// GET /api/favorites
router.get('/', verifyToken, requireRole('client'), (req, res) => {
  const user = db.prepare('SELECT lat, lng FROM users WHERE id = ?').get(req.user.id);
  const rows = db.prepare(`
    SELECT s.* FROM store_favorites sf
    JOIN stores s ON sf.store_id = s.id
    WHERE sf.client_id = ?
    ORDER BY sf.created_at DESC
  `).all(req.user.id);

  res.json({ stores: rows.map((s) => enrichStore(s, user.lat, user.lng)) });
});

// GET /api/favorites/ids
router.get('/ids', verifyToken, requireRole('client'), (req, res) => {
  const ids = db.prepare('SELECT store_id FROM store_favorites WHERE client_id = ?').all(req.user.id);
  res.json({ store_ids: ids.map((r) => r.store_id) });
});

// POST /api/favorites/toggle
router.post('/toggle', verifyToken, requireRole('client'), (req, res) => {
  const { store_id } = req.body;
  if (!store_id) return res.status(400).json({ error: 'store_id requis' });

  const store = db.prepare('SELECT id FROM stores WHERE id = ?').get(store_id);
  if (!store) return res.status(404).json({ error: 'Commerce introuvable' });

  const existing = db.prepare(
    'SELECT id FROM store_favorites WHERE client_id = ? AND store_id = ?'
  ).get(req.user.id, store_id);

  if (existing) {
    db.prepare('DELETE FROM store_favorites WHERE id = ?').run(existing.id);
    return res.json({ favorited: false });
  }

  db.prepare(
    'INSERT INTO store_favorites (id, client_id, store_id) VALUES (?, ?, ?)'
  ).run(db.generateId(), req.user.id, store_id);
  res.json({ favorited: true });
});

module.exports = router;
