/**
 * Garde du Bac à Sable.
 *
 * Certains pouvoirs du Laboratoire (impersonation, actions de labo via organes)
 * sont RÉSERVÉS à l'environnement sandbox et ne doivent JAMAIS s'activer en
 * production. Cette garde centralise la règle en un seul point.
 *
 * Règle (durcie à l'étape 0 de la roadmap Orchestration) : le sandbox est actif
 * en développement par défaut, désactivable via SANDBOX_MODE=off, et JAMAIS
 * activable en production. `SANDBOX_MODE=on` combiné à NODE_ENV=production fait
 * échouer le démarrage dans `config/env.js` : la configuration dangereuse est
 * refusée bruyamment plutôt qu'ignorée en silence.
 */

const config = require('../config/env');

function isSandbox() {
  if (config.isProduction) return false;
  if (process.env.SANDBOX_MODE === 'on') return true;
  if (process.env.SANDBOX_MODE === 'off') return false;
  return true;
}

/**
 * Middleware Express : refuse l'accès hors sandbox.
 * À placer après `verifyAdmin` sur les routes à pouvoirs.
 */
function requireSandbox(req, res, next) {
  if (!isSandbox()) {
    return res.status(403).json({
      error: 'Pouvoir réservé au Bac à Sable (indisponible en production).',
    });
  }
  next();
}

module.exports = { isSandbox, requireSandbox };
