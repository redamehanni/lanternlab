/**
 * Intention — accepter une opportunité reçue.
 *
 * C'est la MIGRATION de `eventEngine/orchestration.js`, qui orchestrait déjà Event
 * vers Wallet. Sa logique de choix — billet payant, billet gratuit ou badge selon le
 * type et le régime de réservation — n'a pas bougé d'une ligne : elle dépend du type
 * d'initiative, donc elle appartient à l'Event Engine.
 *
 * Ce que l'étape 5 apporte : cette séquence est désormais journalisée et compensable
 * comme les autres. Avant, si l'objet Wallet était émis mais que la suite échouait,
 * l'habitant se retrouvait avec un billet pour une acceptation inexistante.
 */

const { defineIntent } = require('../intentRegistry');

defineIntent({
  id: 'event.claim_opportunity',
  label: 'Accepter une opportunité',
  actors: ['client', 'merchant', 'driver'],
  params: {
    inboxId: 'string',
    ownerId: 'string',
  },
  plan: () => [
    // Lecture d'abord : une initiative retirée ou complète doit être refusée avant
    // qu'un objet numérique soit émis au nom de quelqu'un.
    { organ: 'events', action: 'loadOpportunity', compensate: null },

    { organ: 'wallet', action: 'claimOpportunity', compensate: 'revokeClaimedObject' },

    // Si cette écriture échoue, le billet émis juste avant est révoqué. C'est
    // exactement le trou que l'orchestration vient boucher.
    { organ: 'events', action: 'markOpportunityAccepted', compensate: null },
  ],
});
