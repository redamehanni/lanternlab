const express = require('express');
const db = require('../db');
const { verifyToken, requireRole } = require('../middleware/auth');
const { assignPendingOrdersToDriver } = require('../lib/dispatch');

const router = express.Router();

// GET /api/drivers/broadcast — message global Ma Zone → livreurs
router.get('/broadcast', verifyToken, requireRole('driver'), (req, res) => {
  const msg = db.prepare(`
    SELECT content, updated_at FROM driver_broadcast
    WHERE active = 1 ORDER BY updated_at DESC LIMIT 1
  `).get();
  res.json({ message: msg?.content || null });
});

// GET /api/drivers/online — statut en ligne persisté
router.get('/online', verifyToken, requireRole('driver'), (req, res) => {
  const row = db.prepare('SELECT driver_online FROM users WHERE id = ?').get(req.user.id);
  res.json({ online: !!row?.driver_online });
});

// PUT /api/drivers/online — sauvegarder le statut + dispatch auto
router.put('/online', verifyToken, requireRole('driver'), (req, res) => {
  const online = !!req.body.online;
  const io = req.app.get('io');
  db.prepare('UPDATE users SET driver_online = ? WHERE id = ?').run(online ? 1 : 0, req.user.id);

  let assigned = null;
  let offered = null;
  if (online) {
    const result = assignPendingOrdersToDriver(req.user.id, io);
    if (result?.offer) {
      offered = result;
    } else {
      assigned = result;
    }
  }

  res.json({
    online,
    assigned,
    offered,
    mission: assigned?.mission || null,
  });
});

// GET /api/drivers/notifications — notifications système
router.get('/notifications', verifyToken, requireRole('driver'), (req, res) => {
  const notifications = db.prepare(`
    SELECT id, title, body, type, read, created_at
    FROM driver_notifications
    WHERE user_id = ? OR user_id IS NULL
    ORDER BY created_at DESC LIMIT 50
  `).all(req.user.id);
  res.json({ notifications });
});

// PATCH /api/drivers/notifications/:id/read
router.patch('/notifications/:id/read', verifyToken, requireRole('driver'), (req, res) => {
  db.prepare(`
    UPDATE driver_notifications SET read = 1
    WHERE id = ? AND (user_id = ? OR user_id IS NULL)
  `).run(req.params.id, req.user.id);
  res.json({ ok: true });
});

// POST /api/drivers/support/resolve — fil assistance Ma Zone
router.post('/support/resolve', verifyToken, requireRole('driver'), (req, res) => {
  let thread = db.prepare(`
    SELECT id FROM support_threads WHERE user_id = ? AND role = 'driver' LIMIT 1
  `).get(req.user.id);

  if (!thread) {
    const id = db.generateId();
    db.prepare(`INSERT INTO support_threads (id, user_id, role) VALUES (?, ?, 'driver')`).run(id, req.user.id);
    thread = { id };
    db.prepare(`
      INSERT INTO support_messages (id, thread_id, sender_id, content)
      VALUES (?, ?, ?, ?)
    `).run(db.generateId(), id, req.user.id, 'Bonjour, j\'ai besoin d\'assistance.');
  }

  res.json({
    thread: { id: thread.id },
    conversation: {
      id: thread.id,
      kind: 'driver_support',
      other: { name: 'Assistance Ma Zone', photo_url: null },
    },
  });
});

// GET /api/drivers/support/:threadId/messages
router.get('/support/:threadId/messages', verifyToken, requireRole('driver'), (req, res) => {
  const thread = db.prepare('SELECT * FROM support_threads WHERE id = ? AND user_id = ?').get(req.params.threadId, req.user.id);
  if (!thread) return res.status(404).json({ error: 'Fil introuvable' });

  const messages = db.prepare(`
    SELECT m.*, u.name as sender_name, u.role as sender_role
    FROM support_messages m JOIN users u ON m.sender_id = u.id
    WHERE m.thread_id = ? ORDER BY m.created_at ASC
  `).all(thread.id);

  res.json({ messages });
});

// POST /api/drivers/support/:threadId/messages
router.post('/support/:threadId/messages', verifyToken, requireRole('driver'), (req, res) => {
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
