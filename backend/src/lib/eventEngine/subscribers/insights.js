/**
 * Abonné du hook interne — Statistiques & activité (LECTURE SEULE).
 *
 * Démontre la promesse de la Phase 5 : des consommateurs (stats, notifications,
 * futures IA) se branchent sur les faits de domaine du moteur SANS toucher au
 * cœur ni réécrire les flux socket existants. Cet abonné se contente d'observer :
 * il tient des compteurs et un fil d'activité récent en mémoire.
 *
 * GARDE : un abonné LIT et agrège ; il ne mute jamais le cœur. Une erreur ici
 * est isolée par le bus et n'impacte jamais l'opération métier.
 */

const bus = require('../bus');

const MAX_FEED = 50;

const state = {
  counters: {},        // fait de domaine → nombre
  reachedTotal: 0,     // portée cumulée des Opportunités Volantes
  ticketsIssued: 0,    // billets orchestrés
  discoveries: 0,      // Lanternes découvertes
  feed: [],            // derniers faits (fil d'activité léger)
};

function record(evt) {
  state.counters[evt.channel] = (state.counters[evt.channel] || 0) + 1;
  if (evt.channel === bus.DOMAIN_EVENT.DIFFUSED) state.reachedTotal += evt.reached || 0;
  if (evt.channel === bus.DOMAIN_EVENT.TICKET_ISSUED) state.ticketsIssued += 1;
  if (evt.channel === bus.DOMAIN_EVENT.DISCOVERED) state.discoveries += 1;

  state.feed.unshift({
    fact: evt.channel,
    eventId: evt.event?.id || null,
    title: evt.event?.title || null,
    at: new Date().toISOString(),
  });
  if (state.feed.length > MAX_FEED) state.feed.length = MAX_FEED;
}

let registered = false;
function register() {
  if (registered) return;
  bus.subscribe('*', record);
  registered = true;
}

/** Instantané des statistiques agrégées (consommable par une surface/API). */
function snapshot() {
  return {
    counters: { ...state.counters },
    reachedTotal: state.reachedTotal,
    ticketsIssued: state.ticketsIssued,
    discoveries: state.discoveries,
    recent: state.feed.slice(0, 10),
  };
}

module.exports = { register, snapshot };
