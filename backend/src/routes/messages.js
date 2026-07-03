const express = require('express');
const db = require('../db');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

// GET /api/messages/:orderId — historique du chat
router.get('/:orderId', verifyToken, (req, res) => {
  const messages = db.prepare(`
    SELECT m.*, u.name as sender_name, u.role as sender_role
    FROM messages m
    JOIN users u ON m.sender_id = u.id
    WHERE m.order_id = ?
    ORDER BY m.created_at ASC
  `).all(req.params.orderId);
  res.json({ messages });
});

// POST /api/messages — envoyer un message
router.post('/', verifyToken, (req, res) => {
  const { order_id, content } = req.body;
  if (!order_id || !content?.trim()) {
    return res.status(400).json({ error: 'order_id et content requis' });
  }

  const id = db.generateId();
  db.prepare('INSERT INTO messages (id, order_id, sender_id, content) VALUES (?, ?, ?, ?)').run(
    id, order_id, req.user.id, content.trim()
  );

  const message = db.prepare(`
    SELECT m.*, u.name as sender_name, u.role as sender_role
    FROM messages m JOIN users u ON m.sender_id = u.id
    WHERE m.id = ?
  `).get(id);

  req.app.get('io').to(`order_${order_id}`).emit('message:new', { message });
  res.status(201).json({ message });
});

module.exports = router;
