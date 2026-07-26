/**
 * Organe Orders — projection d'affichage.
 *
 * Vient de l'ancien `lib/orders.js`, déplacé sans être réécrit : le corps de la
 * requête est identique, seul son domicile change. Les surfaces (mobile, admin,
 * sockets) consomment cette forme aplatie ; le moteur, lui, ne lit que `orders`.
 *
 * C'est une LECTURE. Aucune décision ne doit s'appuyer sur ces champs joints :
 * ils appartiennent à d'autres entités du CDM et peuvent devenir des miroirs.
 */

const db = require('../../db');

function getFullOrder(orderId) {
  return db.prepare(`
    SELECT o.*,
      u.name as client_name, u.phone as client_phone, u.address as client_address,
      u.lat as client_lat, u.lng as client_lng,
      p.name as product_name, p.image_url as product_image, p.description as product_description,
      s.name as store_name, s.address as store_address, s.lat as store_lat, s.lng as store_lng,
      s.merchant_id as merchant_id,
      m.id as mission_id, m.status as mission_status, m.driver_id,
      d.name as driver_name, d.phone as driver_phone
    FROM orders o
    JOIN users u ON o.client_id = u.id
    JOIN products p ON o.product_id = p.id
    JOIN stores s ON o.store_id = s.id
    LEFT JOIN missions m ON m.order_id = o.id
    LEFT JOIN users d ON m.driver_id = d.id
    WHERE o.id = ?
  `).get(orderId);
}

/**
 * Commandes d'un client, ou d'une boutique. Lecture uniquement.
 *
 * AJOUTÉ À L'ÉTAPE 7. Ces deux listes existaient déjà, en SQL, dans `routes/orders.js`.
 * `/api/v1` en avait besoin, et les recopier aurait donné quatre requêtes pour deux
 * questions : le jour où une commande gagne un champ à afficher, deux des quatre seraient
 * oubliées. Elles vivent donc dans l'organe, qui est le seul à savoir ce qu'est une
 * commande.
 *
 * Les routes historiques n'ont pas été modifiées pour autant : leur forme de réponse est
 * un contrat de fait avec des applications déjà installées. Elles migreront quand `/api`
 * mourra (échéance dans `lib/sunset.js`), pas avant.
 */
function listOrders({ clientId = null, storeId = null, limit = 100 }) {
  if (!clientId && !storeId) {
    throw new Error('[Orders] listOrders exige un clientId ou un storeId');
  }

  const scope = clientId ? 'o.client_id = ?' : 'o.store_id = ?';

  return db.prepare(`
    SELECT o.*,
      p.name as product_name, p.image_url as product_image,
      s.name as store_name, s.address as store_address,
      m.id as mission_id, m.status as mission_status, m.driver_id
    FROM orders o
    JOIN products p ON o.product_id = p.id
    JOIN stores s ON o.store_id = s.id
    LEFT JOIN missions m ON m.order_id = o.id
    WHERE ${scope}
    ORDER BY o.created_at DESC
    LIMIT ?
  `).all(clientId || storeId, limit);
}

module.exports = { getFullOrder, listOrders };
