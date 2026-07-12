const express = require('express');
const { verifyToken } = require('../middleware/auth');
const engine = require('../lib/communicationEngine');

const router = express.Router();

router.get('/', verifyToken, (req, res) => {
  const threads = engine.listThreads(req.user.id, req.user.role, {});
  res.json({ conversations: threads, threads });
});

router.post('/resolve', verifyToken, (req, res) => {
  try {
    const { order_id, store_id, target_role } = req.body;
    const conv = engine.resolveThread({
      userId: req.user.id,
      role: req.user.role,
      orderId: order_id,
      storeId: store_id,
      targetRole: target_role,
    });
    const thread = engine.enrichThread(conv, req.user.id, req.user.role);
    res.json({ conversation: thread, thread });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message || 'Erreur' });
  }
});

router.get('/:id/messages', verifyToken, (req, res) => {
  try {
    const data = engine.getMessages(req.params.id, req.user.id, req.user.role);
    engine.markThreadRead(req.params.id, req.user.id, req.user.role);
    if (data.thread) data.thread.unread_count = 0;
    if (data.conversation) data.conversation.unread_count = 0;
    res.json(data);
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message || 'Erreur' });
  }
});

router.post('/:id/messages', verifyToken, (req, res) => {
  try {
    const io = req.app.get('io');
    const message = engine.sendMessage(
      req.params.id,
      req.user.id,
      req.user.role,
      req.body.content,
      req.body.context_order_id,
      io
    );
    res.status(201).json({ message });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message || 'Erreur' });
  }
});

router.post('/:id/read', verifyToken, (req, res) => {
  try {
    res.json(engine.markThreadRead(req.params.id, req.user.id, req.user.role));
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message || 'Erreur' });
  }
});

module.exports = router;
