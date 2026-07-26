/**
 * Intention — fermer exceptionnellement la boutique.
 *
 * L'exemple le plus net de ce que l'orchestration apporte : « je ferme aujourd'hui »
 * est UNE phrase pour le commerçant, et quatre effets dans quatre organes. Avant, il
 * fallait retirer ses produits un par un et prévenir ses clients à la main.
 *
 * L'ordre n'est pas indifférent. On ferme la vente AVANT d'annoncer : annoncer d'abord
 * laisserait passer des commandes pendant que l'annonce se diffuse.
 */

const { defineIntent } = require('../intentRegistry');

defineIntent({
  id: 'store.close_exceptionally',
  label: 'Fermer exceptionnellement la boutique',
  actors: ['merchant', 'admin'],
  params: {
    storeId: 'string',
    reason: 'string?',
    until: 'string?',
  },
  plan: () => [
    // Plus rien ne peut être commandé. Compensable : la liste exacte des produits
    // retirés est mémorisée, pour ne pas remettre en vente ceux que le commerçant
    // avait délibérément masqués avant la fermeture.
    { organ: 'catalog', action: 'deactivateStoreProducts', compensate: 'reactivateProducts' },

    // Le quartier est informé par le canal qui existe déjà pour cela.
    { organ: 'events', action: 'announceClosure', compensate: 'retractAnnouncement' },

    // Les clients qui attendent une livraison de cette boutique sont prévenus
    // individuellement. Une annonce publique ne les atteindrait pas à temps.
    { organ: 'notifications', action: 'notifyOpenOrders', compensate: null },
  ],
});
