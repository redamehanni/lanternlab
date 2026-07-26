/**
 * Integration Engine — erreurs du moteur.
 *
 * Isolées dans leur fichier pour une raison pratique : `installations.js`,
 * `outbox.js` et `bindings.js` en ont besoin sans avoir à se connaître entre eux.
 */

class IntegrationError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = 'IntegrationError';
    this.status = status;
  }
}

/**
 * Un message entrant est refusé.
 *
 * Distincte d'`IntegrationError` parce qu'elle n'appelle pas la même réaction : une
 * erreur de moteur se corrige, un message refusé se journalise en conflit et se
 * raconte au commerçant.
 */
class SyncRejectedError extends IntegrationError {
  constructor(message, reason) {
    super(message, 409);
    this.name = 'SyncRejectedError';
    this.reason = reason;
  }
}

module.exports = { IntegrationError, SyncRejectedError };
