const express = require('express');
const multer = require('multer');
const path = require('path');
const db = require('../db');
const { verifyToken, requireRole } = require('../middleware/auth');
const { distanceKm } = require('../lib/geo');

const router = express.Router();

const storage = multer.diskStorage({
  destination: path.join(__dirname, '../../uploads'),
  filename: (req, file, cb) => cb(null, `store_${Date.now()}-${file.originalname.replace(/\s/g, '_')}`),
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

// GET /api/stores — liste de tous les commerces (Commerces autour de moi, issue #12)
router.get('/', verifyToken, (req, res) => {
  const me = db.prepare('SELECT lat, lng FROM users WHERE id = ?').get(req.user.id);
  const rows = db.prepare(`
    SELECT s.*,
      (SELECT COUNT(*) FROM products p WHERE p.store_id = s.id AND p.active = 1) as product_count
    FROM stores s
    ORDER BY s.created_at DESC
  `).all();

  const stores = rows.map((s) => {
    const dist = distanceKm(me?.lat, me?.lng, s.lat, s.lng);
    return { ...s, distance_km: dist != null ? Math.round(dist * 10) / 10 : null };
  });

  // tri par distance quand disponible
  stores.sort((a, b) => {
    if (a.distance_km == null) return 1;
    if (b.distance_km == null) return -1;
    return a.distance_km - b.distance_km;
  });

  res.json({ stores });
});

// GET /api/stores/mine — store du commerçant connecté
router.get('/mine', verifyToken, requireRole('merchant'), (req, res) => {
  const store = db.prepare('SELECT * FROM stores WHERE merchant_id = ?').get(req.user.id);
  res.json({ store: store || null });
});

// GET /api/stores/:id — fiche commerce + produits
router.get('/:id', verifyToken, (req, res) => {
  const store = db.prepare('SELECT * FROM stores WHERE id = ?').get(req.params.id);
  if (!store) return res.status(404).json({ error: 'Boutique introuvable' });

  const me = db.prepare('SELECT lat, lng FROM users WHERE id = ?').get(req.user.id);
  const dist = distanceKm(me?.lat, me?.lng, store.lat, store.lng);

  const products = db.prepare(
    'SELECT * FROM products WHERE store_id = ? AND active = 1 ORDER BY created_at DESC'
  ).all(store.id);

  res.json({
    store: { ...store, distance_km: dist != null ? Math.round(dist * 10) / 10 : null },
    products,
  });
});

// POST /api/stores — créer une boutique
router.post('/', verifyToken, requireRole('merchant'), upload.single('photo'), (req, res) => {
  const existing = db.prepare('SELECT id FROM stores WHERE merchant_id = ?').get(req.user.id);
  if (existing) return res.status(409).json({ error: 'Vous avez déjà une boutique' });

  const { name, address, description, phone, email, lat, lng, category, story } = req.body;
  if (!name || !address) return res.status(400).json({ error: 'name et address requis' });

  const id = db.generateId();
  const photo_url = req.file ? `/uploads/${req.file.filename}` : null;

  db.prepare(
    `INSERT INTO stores (id, merchant_id, name, address, description, phone, email, lat, lng, category, story, photo_url)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id, req.user.id, name, address, description || null, phone || null, email || null,
    lat ? parseFloat(lat) : null, lng ? parseFloat(lng) : null, category || null, story || null, photo_url
  );

  const store = db.prepare('SELECT * FROM stores WHERE id = ?').get(id);
  req.app.get('io').emit('store:created', { store });
  res.status(201).json({ store });
});

// PUT /api/stores/:id — modifier la boutique
router.put('/:id', verifyToken, requireRole('merchant'), upload.single('photo'), (req, res) => {
  const store = db.prepare('SELECT * FROM stores WHERE id = ? AND merchant_id = ?').get(req.params.id, req.user.id);
  if (!store) return res.status(404).json({ error: 'Boutique introuvable ou non autorisé' });

  const { name, address, description, phone, email, lat, lng, category, story } = req.body;
  const photo_url = req.file ? `/uploads/${req.file.filename}` : store.photo_url;

  db.prepare(
    `UPDATE stores SET name=?, address=?, description=?, phone=?, email=?, lat=?, lng=?, category=?, story=?, photo_url=? WHERE id=?`
  ).run(
    name || store.name,
    address || store.address,
    description ?? store.description,
    phone ?? store.phone,
    email ?? store.email,
    lat != null && lat !== '' ? parseFloat(lat) : store.lat,
    lng != null && lng !== '' ? parseFloat(lng) : store.lng,
    category ?? store.category,
    story ?? store.story,
    photo_url,
    store.id
  );

  const updated = db.prepare('SELECT * FROM stores WHERE id = ?').get(store.id);
  req.app.get('io').emit('store:updated', { store: updated });
  res.json({ store: updated });
});

module.exports = router;
