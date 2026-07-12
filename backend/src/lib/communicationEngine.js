const db = require('../db');
const policies = require('./communicationPolicies');
const { countUnread, markRead } = require('./unread');

function otherParticipant(conv, myId) {
  if (conv.participant_mode === 'store_team') {
    if (conv.user_a === myId) return conv.user_b;
    if (conv.user_b === myId) return conv.user_a;
    return conv.user_a;
  }
  return conv.user_a === myId ? conv.user_b : conv.user_a;
}

function getStore(storeId) {
  if (!storeId) return null;
  return db
    .prepare('SELECT id, name, address, photo_url, merchant_id FROM stores WHERE id = ?')
    .get(storeId);
}

function getUser(userId) {
  if (!userId) return null;
  return db.prepare('SELECT id, name, role, photo_url FROM users WHERE id = ?').get(userId);
}

function enrichThread(conv, viewerId, viewerRole) {
  const last = db
    .prepare('SELECT content, created_at FROM messages WHERE conversation_id = ? ORDER BY created_at DESC LIMIT 1')
    .get(conv.id);

  let party;
  let other = null;
  let displayName;

  if (conv.kind === 'client_merchant' && conv.store_id) {
    const store = getStore(conv.store_id);
    party = { type: 'store', store };
    displayName = store?.name || 'Commerce';
    if (viewerRole === 'merchant') {
      other = getUser(conv.user_a);
      displayName = other?.name || displayName;
    }
  } else {
    const otherId = conv.user_a === viewerId ? conv.user_b : conv.user_a;
    other = getUser(otherId);
    party = { type: 'user', user: other };
    displayName = other?.name || 'Utilisateur';
  }

  const order = conv.order_id
    ? db
        .prepare(
          `SELECT o.id, o.status, p.name as product_name, p.image_url as product_image
           FROM orders o JOIN products p ON o.product_id = p.id WHERE o.id = ?`
        )
        .get(conv.order_id)
    : null;

  return {
    id: conv.id,
    conversation: conv,
    order_id: conv.order_id,
    store_id: conv.store_id,
    kind: conv.kind,
    lifecycle: conv.lifecycle,
    participant_mode: conv.participant_mode,
    status: conv.status,
    kind_label: policies.KIND_LABEL[conv.kind] || conv.kind,
    other,
    party,
    displayName,
    store: conv.store_id ? getStore(conv.store_id) : null,
    order,
    last_message: last?.content || null,
    last_at: last?.created_at || conv.updated_at || conv.created_at,
    unread_count: countUnread(conv.id, viewerId),
  };
}

function createConversation({
  kind,
  lifecycle,
  participantMode,
  storeId,
  orderId,
  userA,
  userB,
  status = 'active',
}) {
  const id = db.generateId();
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO conversations
     (id, order_id, store_id, kind, lifecycle, participant_mode, user_a, user_b, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, orderId || null, storeId || null, kind, lifecycle, participantMode, userA, userB, status, now, now);
  return db.prepare('SELECT * FROM conversations WHERE id = ?').get(id);
}

function resolveDurableClientMerchant(clientId, storeId, merchantId, contextOrderId) {
  let conv = policies.findDurableClientMerchant(clientId, storeId);
  if (!conv) {
    conv = createConversation({
      kind: 'client_merchant',
      lifecycle: 'durable',
      participantMode: 'store_team',
      storeId,
      orderId: contextOrderId || null,
      userA: clientId,
      userB: merchantId,
    });
  } else if (contextOrderId && !conv.order_id) {
    db.prepare('UPDATE conversations SET order_id = ?, updated_at = datetime(\'now\') WHERE id = ?').run(
      contextOrderId,
      conv.id
    );
    conv = db.prepare('SELECT * FROM conversations WHERE id = ?').get(conv.id);
  }
  return conv;
}

function resolveEphemeral(orderId, kind, userA, userB) {
  if (!policies.isOrderActive(orderId)) {
    const err = new Error('Commande terminée — conversation non disponible');
    err.status = 400;
    throw err;
  }
  let conv = policies.findEphemeralByOrder(orderId, kind);
  if (!conv) {
    conv = createConversation({
      kind,
      lifecycle: 'ephemeral',
      participantMode: 'dyadic',
      orderId,
      userA,
      userB,
    });
  }
  return conv;
}

function resolveThread({ userId, role, orderId, storeId, targetRole }) {
  if (storeId && (targetRole === 'merchant' || role === 'client')) {
    const store = getStore(storeId);
    if (!store) {
      const err = new Error('Commerce introuvable');
      err.status = 404;
      throw err;
    }
    if (role !== 'client') {
      const err = new Error('Accès refusé');
      err.status = 403;
      throw err;
    }
    return resolveDurableClientMerchant(userId, storeId, store.merchant_id, orderId || null);
  }

  if (!orderId || !targetRole) {
    const err = new Error('order_id et target_role requis');
    err.status = 400;
    throw err;
  }

  const order = policies.getOrderContext(orderId);
  if (!order) {
    const err = new Error('Commande introuvable');
    err.status = 404;
    throw err;
  }

  const ids = { client: order.client_id, merchant: order.merchant_id, driver: order.driver_id };
  const otherId = ids[targetRole];
  if (!otherId) {
    const err = new Error('Interlocuteur non disponible pour cette commande');
    err.status = 400;
    throw err;
  }

  const kind = policies.resolveKind(role, targetRole);
  if (!kind) {
    const err = new Error('Type de conversation invalide');
    err.status = 400;
    throw err;
  }

  if (kind === 'client_merchant') {
    const clientId = role === 'client' ? userId : order.client_id;
    return resolveDurableClientMerchant(clientId, order.store_id, order.merchant_id, orderId);
  }

  const me = userId;
  const other = otherId;
  const userA = me < other ? me : other;
  const userB = me < other ? other : me;
  return resolveEphemeral(orderId, kind, userA, userB);
}

function listThreads(userId, role, filters = {}) {
  const rows = policies.getVisibleThreadRows(userId, role, filters);
  return rows
    .map((c) => enrichThread(c, userId, role))
    .sort((a, b) => (b.last_at || '').localeCompare(a.last_at || ''));
}

function getMessages(conversationId, userId, role) {
  const conv = db.prepare('SELECT * FROM conversations WHERE id = ?').get(conversationId);
  if (!conv) {
    const err = new Error('Conversation introuvable');
    err.status = 404;
    throw err;
  }
  if (!policies.canAccessThread(userId, conv)) {
    const err = new Error('Accès refusé');
    err.status = 403;
    throw err;
  }

  const messages = db
    .prepare(
      `SELECT m.*, u.name as sender_name, u.role as sender_role, u.photo_url as sender_photo
       FROM messages m JOIN users u ON m.sender_id = u.id
       WHERE m.conversation_id = ?
       ORDER BY m.created_at ASC`
    )
    .all(conv.id);

  return {
    messages,
    thread: enrichThread(conv, userId, role),
    conversation: enrichThread(conv, userId, role),
  };
}

function sendMessage(conversationId, userId, role, content, contextOrderId, io) {
  const conv = db.prepare('SELECT * FROM conversations WHERE id = ?').get(conversationId);
  if (!conv) {
    const err = new Error('Conversation introuvable');
    err.status = 404;
    throw err;
  }
  if (!policies.canAccessThread(userId, conv)) {
    const err = new Error('Accès refusé');
    err.status = 403;
    throw err;
  }
  if (!content?.trim()) {
    const err = new Error('content requis');
    err.status = 400;
    throw err;
  }

  const orderIdForMsg = contextOrderId || conv.order_id || (() => {
    if (conv.store_id && conv.user_a) {
      const row = db.prepare(
        'SELECT id FROM orders WHERE client_id = ? AND store_id = ? ORDER BY created_at DESC LIMIT 1'
      ).get(conv.user_a, conv.store_id);
      return row?.id || null;
    }
    return null;
  })();

  if (!orderIdForMsg) {
    const err = new Error('Contexte commande requis pour envoyer un message');
    err.status = 400;
    throw err;
  }
  const id = db.generateId();
  db.prepare(
    `INSERT INTO messages (id, order_id, conversation_id, sender_id, content, context_order_id, message_type)
     VALUES (?, ?, ?, ?, ?, ?, 'text')`
  ).run(id, orderIdForMsg, conv.id, userId, content.trim(), contextOrderId || null);

  db.prepare(`UPDATE conversations SET updated_at = datetime('now') WHERE id = ?`).run(conv.id);

  const message = db
    .prepare(
      `SELECT m.*, u.name as sender_name, u.role as sender_role, u.photo_url as sender_photo
       FROM messages m JOIN users u ON m.sender_id = u.id WHERE m.id = ?`
    )
    .get(id);

  if (io) {
    emitThreadUpdate(io, conv, userId, role);
    io.to(`conv_${conv.id}`).emit('message:new', { message, conversationId: conv.id });
  }

  return message;
}

function emitThreadUpdate(io, conv, senderId, senderRole) {
  const payload = {
    conversationId: conv.id,
    kind: conv.kind,
    lifecycle: conv.lifecycle,
    storeId: conv.store_id,
  };

  if (conv.participant_mode === 'store_team' && conv.store_id) {
    io.to(`store_${conv.store_id}`).emit('conversation:updated', payload);
    if (conv.user_a !== senderId) {
      io.to(`user_${conv.user_a}`).emit('conversation:updated', {
        ...payload,
        unreadCount: countUnread(conv.id, conv.user_a),
      });
    }
    return;
  }

  const otherId = conv.user_a === senderId ? conv.user_b : conv.user_a;
  if (otherId) {
    io.to(`user_${otherId}`).emit('conversation:updated', {
      ...payload,
      unreadCount: countUnread(conv.id, otherId),
    });
  }
  if (conv.store_id) {
    io.to(`store_${conv.store_id}`).emit('conversation:updated', payload);
  }
}

function markThreadRead(conversationId, userId, role) {
  const conv = db.prepare('SELECT * FROM conversations WHERE id = ?').get(conversationId);
  if (!conv || !policies.canAccessThread(userId, conv)) {
    const err = new Error('Accès refusé');
    err.status = 403;
    throw err;
  }
  markRead(conversationId, userId);
  return { unread_count: 0 };
}

module.exports = {
  enrichThread,
  resolveThread,
  listThreads,
  getMessages,
  sendMessage,
  markThreadRead,
  emitThreadUpdate,
  resolveDurableClientMerchant,
  resolveEphemeral,
  archiveEphemeralForOrder: policies.archiveEphemeralForOrder,
};
