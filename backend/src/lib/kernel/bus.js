/**
 * Noyau — bus de faits domaine.
 *
 * Promotion de `eventEngine/bus.js`, qui tournait déjà en interne depuis la
 * v0.9.3. Généralisé pour que tous les organes en disposent, au lieu de le
 * réimplémenter chacun de son côté.
 *
 * LOI 8 — ORCHESTRATION IMPÉRATIVE, JAMAIS CHORÉGRAPHIÉE.
 * Ce bus transporte des faits DÉJÀ ARRIVÉS. Il sert aux projections, aux
 * notifications et aux sockets. Il ne doit JAMAIS déclencher une seconde décision
 * métier : l'enchaînement de deux décisions est explicite dans un plan
 * d'intention, lisible dans un seul fichier (étape 5).
 *
 * Une chaîne de décisions par événements est intraçable à 5 000 commerces : plus
 * personne ne peut répondre à « que se passe-t-il quand je vends ».
 *
 * Le bus est en process et ne survit pas à un redémarrage. C'est VOLONTAIRE : la
 * durabilité arrive avec l'Outbox (étape 6), et seulement pour les frontières
 * externes, là où elle est indispensable.
 */

const logger = require('../logger');

const subscribers = new Map(); // canal -> Set<handler>

const FACT_PATTERN = /^[a-z][a-z_]*\.[a-z][a-z_]*$/;

/**
 * Nommage obligatoire : `<organe>.<fait_au_passé>`.
 *
 * Le passé n'est pas une coquetterie. `order.create` se lit comme un ordre — donc
 * comme une décision que l'abonné aurait le droit de prendre. `order.created` se
 * lit comme un constat, et un constat ne se refuse pas.
 */
function assertValidChannel(channel) {
  if (channel === '*') return;
  if (typeof channel !== 'string' || !FACT_PATTERN.test(channel)) {
    throw new Error(
      `[Bus] canal invalide « ${channel} » — attendu <organe>.<fait_au_passé>, `
      + 'par exemple order.created ou inventory.reserved'
    );
  }
}

/**
 * Abonne un handler à un fait. `'*'` observe tout (statistiques, audit).
 * @returns {() => void} désabonnement
 */
function subscribe(channel, handler) {
  assertValidChannel(channel);
  if (typeof handler !== 'function') {
    throw new Error('[Bus] handler doit être une fonction');
  }
  if (!subscribers.has(channel)) subscribers.set(channel, new Set());
  subscribers.get(channel).add(handler);
  return () => subscribers.get(channel)?.delete(handler);
}

/**
 * Émet un fait. Chaque abonné est isolé : son échec est journalisé mais
 * n'interrompt jamais l'appelant.
 *
 * Un abonné qui échoue ne doit pas annuler une vente qui a déjà eu lieu. C'est la
 * contrepartie de la Loi 8 : puisque le bus ne porte aucune décision, on peut se
 * permettre de tolérer l'échec d'un abonné.
 */
function emit(channel, payload = {}) {
  assertValidChannel(channel);
  const targets = [
    ...(subscribers.get(channel) || []),
    ...(subscribers.get('*') || []),
  ];

  for (const handler of targets) {
    try {
      handler({ channel, ...payload });
    } catch (err) {
      logger.reportError(`Abonné en échec sur « ${channel} »`, err, { channel });
    }
  }
}

/** Introspection (tests, diagnostic). */
function subscriberCount(channel) {
  return subscribers.get(channel)?.size || 0;
}

/** Réinitialisation — tests uniquement. */
function reset() {
  subscribers.clear();
}

module.exports = { subscribe, emit, subscriberCount, reset, assertValidChannel };
