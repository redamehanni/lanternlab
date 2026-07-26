/**
 * Intention — annuler une commande.
 *
 * L'appartenance est vérifiée par une ÉTAPE et non par la route : une intention doit
 * refuser d'elle-même ce qu'elle n'a pas le droit de faire, quelle que soit la surface
 * qui la formule. Demain l'API v1 exposera la même intention sans repasser par le
 * contrôle d'accès HTTP.
 */

const { defineIntent } = require('../intentRegistry');

defineIntent({
  id: 'order.cancel',
  label: 'Annuler une commande',
  actors: ['client'],
  params: {
    orderId: 'string',
    reason: 'string?',
  },
  plan: () => [
    // Sans compensation : refuser l'accès n'écrit rien, il n'y a rien à défaire.
    { organ: 'orders', action: 'assertClientOwns', compensate: null },

    // Annule la vente, libère la réservation de stock et la mission, en une
    // transaction. `compensate: null` parce que ressusciter une commande annulée
    // n'est pas une opération que l'organe Orders accepte — et ne doit pas l'être.
    { organ: 'orders', action: 'cancel', compensate: null },

    // Les livreurs libérés doivent se voir proposer autre chose. C'est une décision
    // du dispatch, déclenchée explicitement, jamais depuis un abonné.
    { organ: 'dispatch', action: 'reassignFreedDrivers', compensate: null },

    { organ: 'integration', action: 'pushCancel', optional: true, requires: 'push_sales' },
  ],
});
