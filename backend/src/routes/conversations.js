const express = require('express');
const db = require('../db');
const { verifyToken } = require('../middleware/auth');
const { getOrCreateConversation } = require('../lib/conversations');

const router = express.Router();

const KIND_LABEL = {
  client_merchant: 'Client ↔ Commerçant',
  client_driver: 'Client ↔ Livreur',
  merchant_driver: 'Commerçant ↔ Livreur',
};

function otherParticipant(conv, myId) {
  return conv.user_a === myId ? conv.user_b : conv.user_a;
}

function enrichConversation(conv, myId) {
  const otherId = otherParticipant(conv, myId);
  const other = db.prepare('SELECT id, name, role, photo_url FROM users WHERE id = ?').get(otherId);
  const last = db
    .prepare('SELECT content, created_at FROM messages WHERE conversation_id = ? ORDER BY created_at DESC LIMIT 1')
    .get(conv.id);
  const order = db
    .prepare(`
      SELECT o.id, o.status, p.name as product_name, p.image_url as product_image
      FROM orders o JOIN products p ON o.product_id = p.id WHERE o.id = ?
    `)
    .get(conv.order_id);
  return {
    id: conv.id,
    order_id: conv.order_id,
    kind: conv.kind,
    kind_label: KIND_LABEL[conv.kind] || conv.kind,
    other,
    order,
    last_message: last?.content || null,
    last_at: last?.created_at || conv.created_at,
  };
}

// GET /api/conversations — toutes mes conversations
router.get('/', verifyToken, (req, res) => {
  const rows = db
    .prepare('SELECT * FROM conversations WHERE user_a = ? OR user_b = ? ORDER BY created_at DESC')
    .all(req.user.id, req.user.id);
  const convs = rows
    .map((c) => enrichConversation(c, req.user.id))
    .sort((a, b) => (b.last_at || '').localeCompare(a.last_at || ''));
  res.json({ conversations: convs });
});

// POST /api/conversations/resolve — obtenir/créer une conversation pour une commande + un rôle cible
// body : { order_id, target_role }  (target_role = 'merchant' | 'driver' | 'client')
router.post('/resolve', verifyToken, (req, res) => {
  const { order_id, target_role } = req.body;
  if (!order_id || !target_role) {
    return res.status(400).json({ error: 'order_id et target_role requis' });
  }

  const order = db
    .prepare(`
      SELECT o.client_id, s.merchant_id, m.driver_id
      FROM orders o
      JOIN stores s ON o.store_id = s.id
      LEFT JOIN missions m ON m.order_id = o.id
      WHERE o.id = ?
    `)
    .get(order_id);
  if (!order) return res.status(404).json({ error: 'Commande introuvable' });

  const me = req.user.id;
  const myRole = req.user.role;

  // Déterminer le couple (kind, autre participant)
  const ids = { client: order.client_id, merchant: order.merchant_id, driver: order.driver_id };
  const otherId = ids[target_role];
  if (!otherId) return res.status(400).json({ error: 'Interlocuteur non disponible pour cette commande' });

  const pair = [myRole, target_role].sort().join('_');
  const kindMap = {
    client_merchant: 'client_merchant',
    client_driver: 'client_driver',
    driver_merchant: 'merchant_driver',
  };
  const kind = kindMap[pair];
  if (!kind) return res.status(400).json({ error: 'Type de conversation invalide' });

  const conv = getOrCreateConversation(order_id, kind, me, otherId);
  res.json({ conversation: enrichConversation(conv, me) });
});

// GET /api/conversations/:id/messages — historique d'UNE conversation
router.get('/:id/messages', verifyToken, (req, res) => {
  const conv = db.prepare('SELECT * FROM conversations WHERE id = ?').get(req.params.id);
  if (!conv) return res.status(404).json({ error: 'Conversation introuvable' });
  if (conv.user_a !== req.user.id && conv.user_b !== req.user.id) {
    return res.status(403).json({ error: 'Accès refusé' });
  }

  const messages = db
    .prepare(`
      SELECT m.*, u.name as sender_name, u.role as sender_role, u.photo_url as sender_photo
      FROM messages m JOIN users u ON m.sender_id = u.id
      WHERE m.conversation_id = ?
      ORDER BY m.created_at ASC
    `)
    .all(conv.id);
  res.json({ messages, conversation: enrichConversation(conv, req.user.id) });
});

// POST /api/conversations/:id/messages — envoyer dans UNE conversation
router.post('/:id/messages', verifyToken, (req, res) => {
  const { content } = req.body;
  if (!content?.trim()) return res.status(400).json({ error: 'content requis' });

  const conv = db.prepare('SELECT * FROM conversations WHERE id = ?').get(req.params.id);
  if (!conv) return res.status(404).json({ error: 'Conversation introuvable' });
  if (conv.user_a !== req.user.id && conv.user_b !== req.user.id) {
    return res.status(403).json({ error: 'Accès refusé' });
  }

  const id = db.generateId();
  db.prepare(
    'INSERT INTO messages (id, order_id, conversation_id, sender_id, content) VALUES (?, ?, ?, ?, ?)'
  ).run(id, conv.order_id, conv.id, req.user.id, content.trim());

  const message = db
    .prepare(`
      SELECT m.*, u.name as sender_name, u.role as sender_role, u.photo_url as sender_photo
      FROM messages m JOIN users u ON m.sender_id = u.id WHERE m.id = ?
    `)
    .get(id);

  const io = req.app.get('io');
  // Émettre uniquement dans la room de CETTE conversation
  io.to(`conv_${conv.id}`).emit('message:new', { message, conversationId: conv.id });
  // Notifier l'autre participant (badge) sur sa room perso
  const otherId = otherParticipant(conv, req.user.id);
  io.to(`user_${otherId}`).emit('conversation:updated', { conversationId: conv.id });

  res.status(201).json({ message });
});

module.exports = router;
