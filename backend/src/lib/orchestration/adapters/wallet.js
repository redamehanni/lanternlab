/**
 * Orchestration — adaptateur de l'organe Wallet.
 *
 * `eventEngine/orchestration.js` faisait déjà exactement ce travail : décider quel
 * objet numérique matérialise l'acceptation d'une opportunité, puis appeler le
 * Wallet. Cette logique RESTE chez lui — elle dépend du type d'initiative et de son
 * régime de réservation, donc elle appartient à l'Event Engine.
 *
 * Ce que l'étape 5 change : la séquence devient une intention journalisée et
 * compensable, au lieu d'un enchaînement d'appels invisible.
 */

const eventOrchestration = require('../../eventEngine/orchestration');
const wallet = require('../../walletEngine');

/**
 * Matérialise l'acceptation d'une opportunité : billet ou badge selon le type.
 *
 * @returns {{ objectId: string, kind: string, replayed: boolean }}
 */
function claimOpportunity(params, ctx) {
  const event = ctx.results['events.loadOpportunity']?.event;
  const { object } = eventOrchestration.claimAcceptedOpportunity(event, params.ownerId, ctx.io);
  return { objectId: object.id, kind: object.kind, replayed: false };
}

/**
 * Retire l'objet émis par l'étape compensée.
 *
 * Le Wallet ne détruit pas un objet : il le révoque. Un objet numérique qui
 * disparaîtrait sans trace rendrait impossible de répondre à « où est passé mon
 * billet ». La révocation, elle, se lit dans l'historique.
 */
function revokeClaimedObject(params, ctx) {
  const objectId = ctx.results['wallet.claimOpportunity']?.objectId;
  if (!objectId) return { revoked: false };
  wallet.revokeObject(
    { objectId, reason: 'compensation d\'orchestration', actorEngine: 'orchestration' },
    ctx.io
  );
  return { revoked: true, objectId };
}

module.exports = { claimOpportunity, revokeClaimedObject };
