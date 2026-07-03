const db = require('../db');

/**
 * Récupère ou crée une conversation unique pour une commande donnée,
 * entre deux participants identifiés, d'un type précis.
 *
 * kind : 'client_merchant' | 'client_driver' | 'merchant_driver'
 *
 * L'unicité est garantie par (order_id, kind) : jamais de fusion entre canaux.
 */
function getOrCreateConversation(orderId, kind, userA, userB) {
  if (!userA || !userB) return null;

  let conv = db
    .prepare('SELECT * FROM conversations WHERE order_id = ? AND kind = ?')
    .get(orderId, kind);

  if (!conv) {
    const id = db.generateId();
    db.prepare(
      `INSERT INTO conversations (id, order_id, kind, user_a, user_b) VALUES (?, ?, ?, ?, ?)`
    ).run(id, orderId, kind, userA, userB);
    conv = db.prepare('SELECT * FROM conversations WHERE id = ?').get(id);
  }
  return conv;
}

module.exports = { getOrCreateConversation };
