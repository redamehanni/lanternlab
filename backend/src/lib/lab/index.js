/**
 * Laboratoire — Orchestrateur des actions de labo.
 *
 * Charge les actions déclarées (chaque fichier s'auto-enregistre) et expose une
 * interface mince pour les lister et les exécuter. L'exécution passe TOUJOURS
 * par un organe (voir actionRegistry.js).
 */

const registry = require('./actionRegistry');

// Enregistre les actions disponibles (auto-déclaration par organe).
require('./actions/wallet');
require('./actions/events');

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function listActions() {
  return registry.listActions();
}

/**
 * Exécute une action de labo sur un acteur cible.
 * La garde « cible démo uniquement » est appliquée en amont (route).
 */
function runAction(actionId, { targetUserId, params = {} } = {}, io = null) {
  const action = registry.getAction(actionId);
  if (!action) throw httpError(404, `Action inconnue : ${actionId}`);
  if (!targetUserId) throw httpError(400, 'targetUserId requis');

  const result = action.run({ targetUserId, params, io });
  return { actionId, organ: action.organ, result };
}

module.exports = { listActions, runAction };
