/**
 * Event Engine — Hook interne emit/subscribe.
 *
 * Mécanisme léger permettant à des abonnés (notifications, statistiques, futures
 * IA) de réagir aux faits de domaine du moteur — SANS réécrire les flux socket
 * existants (commandes, missions) et SANS que le cœur ne connaisse ses abonnés.
 *
 * GARDE-FOU : ce bus n'est PAS un Event Bus technique universel. Il ne transporte
 * que les faits de domaine du cycle de vie des initiatives locales (event.created,
 * event.published, event.transitioned, event.diffused…). Les abonnés LISENT et
 * réagissent ; ils ne mutent jamais le cœur. Une erreur d'abonné n'interrompt
 * jamais l'opération métier (isolation défensive).
 */

const subscribers = new Map(); // channel -> Set<handler>

/** Faits de domaine émis par le moteur (nommage stable et borné). */
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

/**
 * Abonne un handler à un fait de domaine. Retourne une fonction de désabonnement.
 * `channel` = '*' pour observer tous les faits (stats/IA globales).
 */
function subscribe(channel, handler) {
  if (typeof handler !== 'function') {
    throw new Error('[EventBus] handler doit être une fonction');
  }
  if (!subscribers.has(channel)) subscribers.set(channel, new Set());
  subscribers.get(channel).add(handler);
  return () => subscribers.get(channel)?.delete(handler);
}

/**
 * Émet un fait de domaine. Les abonnés du canal exact et ceux de '*' sont
 * notifiés. Chaque handler est isolé : une exception d'abonné est journalisée
 * mais n'interrompt jamais l'appelant.
 */
function emit(channel, payload) {
  const targets = [
    ...(subscribers.get(channel) || []),
    ...(subscribers.get('*') || []),
  ];
  for (const handler of targets) {
    try {
      handler({ channel, ...payload });
    } catch (err) {
      console.error(`[EventBus] Abonné en échec sur "${channel}" :`, err.message);
    }
  }
}

/** Introspection (tests / debug) : nombre d'abonnés par canal. */
function subscriberCount(channel) {
  return subscribers.get(channel)?.size || 0;
}

module.exports = { DOMAIN_EVENT, subscribe, emit, subscriberCount };
