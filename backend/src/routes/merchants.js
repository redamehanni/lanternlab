const express = require('express');
const db = require('../db');
const { verifyToken, requireRole } = require('../middleware/auth');

const router = express.Router();

// GET /api/merchants/notifications
router.get('/notifications', verifyToken, requireRole('merchant'), (req, res) => {
  const notifications = db.prepare(`
    SELECT id, title, body, type, read, created_at
    FROM merchant_notifications
    WHERE user_id = ? OR user_id IS NULL
    ORDER BY created_at DESC LIMIT 50
  `).all(req.user.id);
  res.json({ notifications });
});

// PATCH /api/merchants/notifications/:id/read
router.patch('/notifications/:id/read', verifyToken, requireRole('merchant'), (req, res) => {
  db.prepare(`
    UPDATE merchant_notifications SET read = 1
    WHERE id = ? AND (user_id = ? OR user_id IS NULL)
  `).run(req.params.id, req.user.id);
  res.json({ ok: true });
});

// POST /api/merchants/support/resolve
router.post('/support/resolve', verifyToken, requireRole('merchant'), (req, res) => {
  let thread = db.prepare(`
    SELECT id FROM support_threads WHERE user_id = ? AND role = 'merchant' LIMIT 1
  `).get(req.user.id);

  if (!thread) {
    const id = db.generateId();
    db.prepare(`INSERT INTO support_threads (id, user_id, role) VALUES (?, ?, 'merchant')`).run(id, req.user.id);
    thread = { id };
  }

  res.json({
    thread: { id: thread.id },
    conversation: {
      id: thread.id,
      kind: 'merchant_support',
      other: { name: 'Assistance Ma Zone', photo_url: null },
    },
  });
});

// GET /api/merchants/support/:threadId/messages
router.get('/support/:threadId/messages', verifyToken, requireRole('merchant'), (req, res) => {
  const thread = db.prepare('SELECT * FROM support_threads WHERE id = ? AND user_id = ?').get(req.params.threadId, req.user.id);
  if (!thread) return res.status(404).json({ error: 'Fil introuvable' });

  const messages = db.prepare(`
    SELECT m.*, u.name as sender_name, u.role as sender_role
    FROM support_messages m JOIN users u ON m.sender_id = u.id
    WHERE m.thread_id = ? ORDER BY m.created_at ASC
  `).all(thread.id);

  res.json({ messages });
});

// POST /api/merchants/support/:threadId/messages
router.post('/support/:threadId/messages', verifyToken, requireRole('merchant'), (req, res) => {
  const { content } = req.body;
  if (!content?.trim()) return res.status(400).json({ error: 'Message vide' });

  const thread = db.prepare('SELECT * FROM support_threads WHERE id = ? AND user_id = ?').get(req.params.threadId, req.user.id);
  if (!thread) return res.status(404).json({ error: 'Fil introuvable' });

  const id = db.generateId();
  db.prepare(`
    INSERT INTO support_messages (id, thread_id, sender_id, content) VALUES (?, ?, ?, ?)
  `).run(id, thread.id, req.user.id, content.trim());

  const msg = db.prepare(`
    SELECT m.*, u.name as sender_name FROM support_messages m
    JOIN users u ON m.sender_id = u.id WHERE m.id = ?
  `).get(id);

  res.json({ message: msg });
});

module.exports = router;
