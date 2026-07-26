/**
 * Event Engine — bus de faits domaine.
 *
 * PROMU AU NOYAU à l'étape 2 de la roadmap Organe d'Orchestration. Ce fichier est
 * désormais un réexport mince de `lib/kernel/bus.js` : aucun appelant n'a été
 * modifié, et les autres organes cessent de réimplémenter le même mécanisme.
 *
 * Les garde-fous d'origine restent valables, et sont devenus des lois :
 *   - le bus transporte des faits DÉJÀ ARRIVÉS, jamais des ordres (Loi 8) ;
 *   - les abonnés LISENT et réagissent, ils ne mutent jamais le cœur ;
 *   - une erreur d'abonné n'interrompt jamais l'opération métier.
 *
 * `DOMAIN_EVENT` reste ici : c'est le vocabulaire de l'Event Engine, pas celui du
 * noyau. Chaque organe nomme ses propres faits.
 */

const kernelBus = require('../kernel/bus');

/** Faits de domaine émis par l'Event Engine (nommage stable et borné). */
const DOMAIN_EVENT = {
  CREATED: 'event.created',
  UPDATED: 'event.updated',
  TRANSITIONED: 'event.transitioned',
  PUBLISHED: 'event.published',
  CANCELLED: 'event.cancelled',
  DIFFUSED: 'event.diffused',
  TICKET_ISSUED: 'event.ticket_issued',
  DISCOVERED: 'event.discovered',
};

module.exports = {
  DOMAIN_EVENT,
  subscribe: kernelBus.subscribe,
  emit: kernelBus.emit,
  subscriberCount: kernelBus.subscriberCount,
};
