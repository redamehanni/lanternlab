/**
 * Organe Orders — conséquences des faits de commande.
 *
 * Tout ce qui était mélangé au métier dans `routes/orders.js` vit ici : sockets,
 * notifications, conversations, archivage. Ces abonnés n'ont AUCUN droit de
 * décision (Loi 8) : ils projettent, ils informent, ils n'arbitrent pas. Le choix
 * d'un livreur ou la réattribution d'une course restent des appels explicites,
 * visibles dans `orders/placement.js`.
 *
 * Un abonné qui échoue ne peut plus annuler la vente : elle est validée. Le bus
 * isole donc chaque handler et journalise ses échecs.
 */

const { bus } = require('../kernel');
const { getOrCreateConversation } = require('../conversations');
const { createMerchantNotification } = require('../merchantNotifications');
const { archiveEphemeralForOrder } = require('../communicationEngine');
const { getFullOrder } = require('./projection');

/** Désabonnements de l'enregistrement courant. */
let installed = [];

/**
 * Charge de `product:stock_updated`.
 *
 * ÉTAPE 7 — `available` est ajouté, `quantity` est conservé. Les deux portent le même
 * nombre, et cette redondance est exactement le but : les sept écrans client et deux
 * écrans commerçant qui lisent `quantity` continuent de fonctionner sans une ligne
 * modifiée, tandis que ce qui migre vers `/api/v1` peut déjà lire le nom juste.
 *
 * `quantity` disparaîtra avec la projection dont il est le reflet — échéance inscrite dans
 * `lib/sunset.js`, après la mort de `/api`. Ajouter un champ est une bascule sans risque ;
 * en renommer un aurait cassé une application déjà installée sur des téléphones.
 */
function stockUpdate(fact, value) {
  return {
    productId: fact.productId,
    storeId: fact.storeId,
    available: value,
    // Nom historique du même nombre. Voir lib/sunset.js pour sa date de retrait.
    quantity: value,
  };
}

/**
 * Branche les abonnés de l'organe Orders.
 *
 * Idempotent : un second appel remplace le premier. Sans cela, deux serveurs créés
 * dans un même process (cas des tests) enverraient chaque notification en double.
 */
function registerOrderSubscribers(io) {
  for (const off of installed) off();
  installed = [];

  const on = (channel, handler) => installed.push(bus.subscribe(channel, handler));

  on('order.created', (fact) => {
    const order = getFullOrder(fact.orderId);
    if (!order) return;

    // La conversation client↔commerçant est ouverte dès la commande : le client
    // doit pouvoir écrire avant même qu'un livreur soit trouvé.
    getOrCreateConversation(fact.orderId, 'client_merchant', fact.clientId, fact.merchantId);

    io.to(`merchant_${fact.merchantId}`).emit('order:new', { order });
    createMerchantNotification(
      fact.merchantId,
      'Nouvelle commande',
      `${order.product_name} — ${order.client_name} (${order.total_price?.toFixed(2)} €)`,
      'order_new'
    );

    io.emit('promotion:updated', { product_id: fact.productId });
    io.emit('product:stock_updated', stockUpdate(fact, fact.remainingStock));
  });

  on('order.transitioned', (fact) => {
    const order = getFullOrder(fact.orderId);
    if (!order) return;
    emitOrderUpdate(io, order);
  });

  on('order.cancelled', (fact) => {
    const order = getFullOrder(fact.orderId);
    if (!order) return;

    // Le minuteur d'offre est coupé APRÈS commit : coupé avant, une transaction
    // annulée aurait laissé une offre qui n'expire jamais.
    if (fact.missionId) {
      require('../dispatchOffer').clearOfferTimeout(fact.missionId);
    }

    archiveEphemeralForOrder(fact.orderId);
    emitOrderUpdate(io, order);

    io.to(`order_${fact.orderId}`).emit('order:cancelled', { orderId: fact.orderId, order });
    io.to(`merchant_${order.merchant_id}`).emit('order:cancelled', { orderId: fact.orderId, order });

    for (const driverId of concernedDrivers(fact)) {
      io.to(`user_${driverId}`).emit('mission:cancelled', {
        missionId: fact.missionId,
        orderId: fact.orderId,
        order,
      });
    }

    io.emit('product:stock_updated', stockUpdate(fact, fact.restoredStock));
  });

  return () => {
    for (const off of installed) off();
    installed = [];
  };
}

/** Livreurs à prévenir d'une annulation, sans doublon. */
function concernedDrivers(fact) {
  return [...new Set([fact.driverId, fact.offeredDriverId].filter(Boolean))];
}

/**
 * Diffusion d'un changement de statut aux trois surfaces concernées.
 *
 * Repris de `dispatch.emitOrderUpdate`, dont c'est le seul appel restant côté
 * commande. Dupliqué ici volontairement : l'organe Orders ne doit pas dépendre du
 * dispatch pour parler de ses propres commandes.
 */
function emitOrderUpdate(io, order) {
  if (!io || !order) return;
  const payload = { orderId: order.id, status: order.status, order };
  io.to(`order_${order.id}`).emit('order:status_updated', payload);
  io.to(`merchant_${order.merchant_id}`).emit('order:status_updated', payload);
  io.to(`user_${order.client_id}`).emit('order:status_updated', payload);
}

module.exports = { registerOrderSubscribers };
