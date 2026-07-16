/**
 * Garde du Bac à Sable.
 *
 * Certains pouvoirs du Laboratoire (impersonation, actions de labo via organes)
 * sont RÉSERVÉS à l'environnement sandbox et ne doivent JAMAIS s'activer en
 * production. Cette garde centralise la règle en un seul point.
 *
 * Règle : actif en développement par défaut ; en production, il faut l'activer
 * explicitement via SANDBOX_MODE=on (choix conscient de l'exploitant).
 */

function isSandbox() {
  if (process.env.SANDBOX_MODE === 'on') return true;
  if (process.env.SANDBOX_MODE === 'off') return false;
  return process.env.NODE_ENV !== 'production';
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
