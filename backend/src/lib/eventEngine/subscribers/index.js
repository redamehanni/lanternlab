/**
 * Event Engine — Abonnés du hook interne (Phase 5).
 *
 * Chaque abonné s'enregistre ici, une seule fois, au chargement du moteur. Un
 * futur abonné (notifications push, IA, exports stats…) se déclare de la même
 * façon, sans modifier le cœur ni les flux socket existants.
 */

const insights = require('./insights');

let done = false;
function registerAll() {
  if (done) return;
  insights.register();
  done = true;
}

module.exports = { registerAll, insights };
