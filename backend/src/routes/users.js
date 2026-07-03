const express = require('express');
const multer = require('multer');
const path = require('path');
const db = require('../db');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

const storage = multer.diskStorage({
  destination: path.join(__dirname, '../../uploads'),
  filename: (req, file, cb) => cb(null, `user_${Date.now()}-${file.originalname.replace(/\s/g, '_')}`),
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

function publicUser(u) {
  if (!u) return null;
  const { password, ...rest } = u;
  return rest;
}

// GET /api/users/me
router.get('/me', verifyToken, (req, res) => {
  const u = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  res.json({ user: publicUser(u) });
});

// PUT /api/users/me — mettre à jour profil + photo (issue #14)
router.put('/me', verifyToken, upload.single('photo'), (req, res) => {
  const u = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!u) return res.status(404).json({ error: 'Utilisateur introuvable' });

  const { name, first_name, last_name, phone, address, lat, lng, transport } = req.body;
  const photo_url = req.file ? `/uploads/${req.file.filename}` : u.photo_url;
  const fullName = name || [first_name || u.first_name, last_name || u.last_name].filter(Boolean).join(' ') || u.name;

  db.prepare(
    `UPDATE users SET name=?, first_name=?, last_name=?, phone=?, address=?, lat=?, lng=?, transport=?, photo_url=? WHERE id=?`
  ).run(
    fullName,
    first_name ?? u.first_name,
    last_name ?? u.last_name,
    phone ?? u.phone,
    address ?? u.address,
    lat != null && lat !== '' ? parseFloat(lat) : u.lat,
    lng != null && lng !== '' ? parseFloat(lng) : u.lng,
    transport ?? u.transport,
    photo_url,
    u.id
  );

  res.json({ user: publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(u.id)) });
});

// ── Adresses du client (issue #9) ────────────────────────────────────────────

// GET /api/users/addresses
router.get('/addresses', verifyToken, (req, res) => {
  const addresses = db.prepare(
    'SELECT * FROM client_addresses WHERE client_id = ? ORDER BY created_at DESC'
  ).all(req.user.id);
  res.json({ addresses });
});

// POST /api/users/addresses
router.post('/addresses', verifyToken, (req, res) => {
  const { label, address, lat, lng } = req.body;
  if (!address?.trim()) return res.status(400).json({ error: 'address requis' });

  const id = db.generateId();
  db.prepare(
    'INSERT INTO client_addresses (id, client_id, label, address, lat, lng) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(id, req.user.id, label || 'Adresse', address.trim(), lat ?? null, lng ?? null);

  res.status(201).json({ address: db.prepare('SELECT * FROM client_addresses WHERE id = ?').get(id) });
});

// DELETE /api/users/addresses/:id
router.delete('/addresses/:id', verifyToken, (req, res) => {
  db.prepare('DELETE FROM client_addresses WHERE id = ? AND client_id = ?').run(req.params.id, req.user.id);
  res.json({ success: true });
});

module.exports = router;
