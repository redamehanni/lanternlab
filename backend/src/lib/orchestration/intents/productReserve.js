/**
 * Intention — mettre un article de côté.
 *
 * Le client réserve sans acheter : il passera en boutique. C'est le geste que Ma Zone
 * ne savait pas exprimer — la seule façon de retenir du stock était de créer une
 * commande, donc une mission de livraison dont personne n'avait besoin.
 *
 * L'intention est distincte de `order.place` parce que le besoin l'est : retenir de la
 * marchandise n'engage ni prix, ni livreur, ni paiement.
 */

const { defineIntent } = require('../intentRegistry');

defineIntent({
  id: 'product.reserve',
  label: 'Mettre un article de côté',
  actors: ['client', 'merchant'],
  params: {
    productId: 'string',
    quantity: 'integer',
    // La référence rend la réservation restituable : sans elle, personne ne saurait
    // quelle mise de côté libérer.
    reference: 'string?',
  },
  plan: () => [
    { organ: 'inventory', action: 'reserve', compensate: 'release' },

    // Le commerçant doit savoir qu'une unité de son rayon est promise, sinon il la
    // vendra deux fois. Dernière étape non optionnelle : rien ne peut plus échouer
    // après, donc l'information envoyée ne sera jamais démentie.
    { organ: 'notifications', action: 'notifyReservation', compensate: null },

    { organ: 'integration', action: 'pushStockMovement', optional: true, requires: 'push_inventory' },
  ],
});
