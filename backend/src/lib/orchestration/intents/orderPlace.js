/**
 * Intention — passer commande.
 *
 * Réponse à la question qui n'avait pas de réponse avant l'étape 5 : « que se
 * passe-t-il exactement quand un client achète ». Tout est ci-dessous, dans l'ordre.
 *
 * Avant, l'enchaînement était réparti entre `routes/orders.js`, `dispatch.js`,
 * `dispatchOffer.js`, `conversations.js` et quatre émissions socket.
 *
 * NE FIGURENT PAS ICI, volontairement : l'ouverture de la conversation
 * client↔commerçant, la notification du commerçant, les émissions socket. Ce sont des
 * CONSÉQUENCES d'un fait déjà acquis, pas des étapes dont l'échec devrait défaire une
 * vente. Elles vivent dans `lib/orders/subscribers.js`, branchées sur `order.created`.
 * Les mettre ici rendrait une vente annulable parce qu'une notification a échoué.
 */

const { defineIntent } = require('../intentRegistry');

defineIntent({
  id: 'order.place',
  label: 'Passer une commande',
  actors: ['client'],
  params: {
    productId: 'string',
    quantity: 'integer',
    deliveryAddress: 'string?',
    deliveryLat: 'number?',
    deliveryLng: 'number?',
  },
  plan: () => [
    // La vente existe et son stock est retenu. Une seule transaction : il n'y a
    // aucun instant où l'un est vrai sans l'autre.
    { organ: 'orders', action: 'create', compensate: 'cancel' },

    // Chercher un livreur est une décision du dispatch, prise APRÈS que la vente
    // soit acquise. Sans compensation : une commande sans livreur est rattrapable,
    // une commande perdue parce qu'aucun livreur n'était en ligne ne l'est pas.
    { organ: 'dispatch', action: 'findDriver', compensate: null },

    // Ce que Ma Zone devrait faire et ne sait pas encore faire. Déclaré pour que le
    // trou soit visible dans le plan, conditionné pour ne bloquer personne.
    { organ: 'integration', action: 'pushSale', optional: true, requires: 'push_sales' },
  ],
});
