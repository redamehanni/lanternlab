/**
 * Autorisations d'accès aux ressources — qui a le droit de VOIR quoi.
 *
 * Étape 1 de la roadmap : trois trous d'autorisation étaient ouverts.
 *   - `GET /api/orders/:id` renvoyait n'importe quelle commande à n'importe quel
 *     porteur de token.
 *   - `PATCH /api/orders/:id/status` acceptait n'importe quel rôle, sans lien avec
 *     la commande : un client pouvait déclarer sa propre commande livrée.
 *   - `join:order` et `join:conversation` (sockets) rejoignaient n'importe quelle
 *     room, donc écoutaient les positions, messages et statuts d'inconnus.
 *
 * Les trois passaient par la même question — « cet utilisateur est-il partie
 * prenante ? » — posée à trois endroits différents et à aucun. Elle est posée ici,
 * une seule fois, et partagée entre HTTP et WebSocket : deux chemins qui divergent
 * finissent toujours par avoir deux niveaux de sécurité.
 */

const db = require('../db');

/** Le commerçant fait-il partie de l'équipe de cette boutique ? */
function isStoreMember(userId, storeId) {
  if (!userId || !storeId) return false;

  const store = db.prepare('SELECT merchant_id FROM stores WHERE id = ?').get(storeId);
  if (store?.merchant_id === userId) return true;

  const membership = db
    .prepare('SELECT 1 AS ok FROM store_members WHERE store_id = ? AND user_id = ?')
    .get(storeId, userId);
  return !!membership;
}

/**
 * Rôle de l'utilisateur vis-à-vis d'une commande, ou `null` s'il n'est pas
 * concerné. Le livreur destinataire d'une offre est inclus : il doit voir la
 * course pour décider de l'accepter.
 */
function orderRelation(user, orderId) {
  if (!user?.id || !orderId) return null;

  const row = db.prepare(`
    SELECT o.client_id, o.store_id, s.merchant_id,
           m.driver_id, m.offered_to_driver_id
    FROM orders o
    JOIN stores s ON o.store_id = s.id
    LEFT JOIN missions m ON m.order_id = o.id
    WHERE o.id = ?
  `).get(orderId);

  if (!row) return null;

  if (row.client_id === user.id) return 'client';
  if (row.driver_id === user.id) return 'driver';
  if (row.offered_to_driver_id === user.id) return 'offered_driver';
  if (isStoreMember(user.id, row.store_id)) return 'merchant';
  return null;
}

/** Peut-on lire cette commande et son suivi ? */
function canViewOrder(user, orderId) {
  return orderRelation(user, orderId) !== null;
}

/**
 * Peut-on faire avancer le statut de cette commande ?
 *
 * Le commerçant et le livreur affecté, jamais le client : un client qui déclare sa
 * commande livrée annule la possibilité de l'annuler. Le client dispose de
 * `POST /api/orders/:id/cancel`, qui applique ses propres règles.
 */
function canChangeOrderStatus(user, orderId) {
  const relation = orderRelation(user, orderId);
  return relation === 'merchant' || relation === 'driver';
}

/** Peut-on lire et écrire dans cette conversation ? */
function canAccessConversation(user, conversationId) {
  if (!user?.id || !conversationId) return false;

  const conv = db
    .prepare('SELECT user_a, user_b, store_id, participant_mode FROM conversations WHERE id = ?')
    .get(conversationId);
  if (!conv) return false;

  if (conv.user_a === user.id || conv.user_b === user.id) return true;
  // Fil durable client-boutique : toute l'équipe y a accès, pas seulement le
  // commerçant qui l'a ouvert.
  if (conv.participant_mode === 'store_team' && isStoreMember(user.id, conv.store_id)) return true;
  return false;
}

module.exports = {
  isStoreMember,
  orderRelation,
  canViewOrder,
  canChangeOrderStatus,
  canAccessConversation,
};
