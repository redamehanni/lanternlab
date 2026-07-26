/**
 * Organe Orders — validation d'un panier.
 *
 * Ce fichier a beaucoup maigri à l'étape 5. `placeOrder` et `cancelOrderForClient`
 * n'existent plus : leur séquence est devenue les intentions `order.place` et
 * `order.cancel`, déclarées dans `lib/orchestration/intents/`. Elles sont maintenant
 * journalisées et compensées, ce qu'un enchaînement impératif ne savait pas faire.
 *
 * Ce qui reste ici est ce qui n'est PAS une intention : un panier de N articles n'a
 * pas de plan fixe, il a autant de plans que d'articles. Un plan d'intention est une
 * liste connue à l'avance — c'est ce qui le rend lisible, et on ne va pas sacrifier
 * cette propriété pour un cas à longueur variable.
 */

const db = require('../../db');

/**
 * Valide un panier : une intention de vente par article, puis vidage du panier.
 *
 * DETTE ASSUMÉE, inchangée depuis l'étape 1 : N articles produisent N commandes
 * indépendantes, chacune avec sa mission et son livreur. Le corriger demande une
 * entité `OrderLine` et touche les trois surfaces mobiles.
 *
 * Comportement en cas d'échec, explicite : les commandes déjà passées sont
 * CONSERVÉES, le panier n'est pas vidé, et l'appelant reçoit les deux informations.
 *
 * @returns {{ orders: object[], failed: {productName: string, error: string}|null }}
 */
function placeCart({ io, clientId, deliveryAddress, deliveryLat, deliveryLng }) {
  const orchestration = require('../orchestration');
  const orderEngine = require('./orderEngine');

  const items = db.prepare(`
    SELECT ci.*, p.name as product_name
    FROM cart_items ci
    JOIN products p ON ci.product_id = p.id
    WHERE ci.client_id = ? AND p.active = 1
  `).all(clientId);

  if (!items.length) throw new orderEngine.OrderError('Panier vide', 400);

  const orders = [];
  for (const item of items) {
    try {
      const run = orchestration.run('order.place', {
        productId: item.product_id,
        quantity: item.quantity,
        deliveryAddress: deliveryAddress ?? null,
        deliveryLat: deliveryLat ?? null,
        deliveryLng: deliveryLng ?? null,
      }, { actor: clientId, actorRole: 'client', io });

      orders.push(orderEngine.getOrder(run.results['orders.create'].order.id));
    } catch (err) {
      return { orders, failed: { productName: item.product_name, error: err.message } };
    }
  }

  db.prepare('DELETE FROM cart_items WHERE client_id = ?').run(clientId);
  return { orders, failed: null };
}

module.exports = { placeCart };
