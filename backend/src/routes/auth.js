const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { JWT_SECRET } = require('../middleware/auth');

const router = express.Router();

// POST /api/auth/register
router.post('/register', async (req, res) => {
  const { name, email, password, phone, role, address, transport, lat, lng } = req.body;

  if (!name || !email || !password || !role) {
    return res.status(400).json({ error: 'Champs requis : name, email, password, role' });
  }
  if (!['client', 'merchant', 'driver'].includes(role)) {
    return res.status(400).json({ error: 'Rôle invalide (client | merchant | driver)' });
  }
  if (db.prepare('SELECT id FROM users WHERE email = ?').get(email)) {
    return res.status(409).json({ error: 'Email déjà utilisé' });
  }

  const hash = await bcrypt.hash(password, 10);
  const id = db.generateId();

  db.prepare(
    `INSERT INTO users (id, name, email, password, phone, role, address, transport, lat, lng)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id, name, email, hash, phone || null, role, address || null, transport || null,
    lat != null ? parseFloat(lat) : null, lng != null ? parseFloat(lng) : null
  );

  const user = db.prepare('SELECT id, name, email, phone, role, address, transport, lat, lng, photo_url FROM users WHERE id = ?').get(id);
  const token = jwt.sign({ id, name, email, role }, JWT_SECRET, { expiresIn: '30d' });
  res.status(201).json({ user, token });
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email et mot de passe requis' });
  }

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user || !(await bcrypt.compare(password, user.password))) {
    return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
  }

  const { password: _, ...userData } = user;
  const token = jwt.sign({ id: user.id, name: user.name, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '30d' });
  res.json({ user: userData, token });
});

module.exports = router;
