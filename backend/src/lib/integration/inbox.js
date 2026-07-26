/**
 * Integration Engine — file entrante.
 *
 * Tout ce qui vient d'un logiciel tiers atterrit ici avant de toucher quoi que ce soit.
 *
 * POURQUOI NE PAS TRAITER DIRECTEMENT DANS LA REQUÊTE HTTP. Un éditeur qui envoie un
 * webhook attend une réponse en quelques secondes ; s'il ne l'obtient pas, il rejoue —
 * puis il rejoue encore, puis il désactive l'abonnement. Traiter le message dans la
 * requête, c'est faire dépendre la fiabilité de notre intégration de la durée d'une
 * écriture en base pendant que le worker de stock tient le verrou.
 *
 * Donc : on vérifie, on persiste, on répond **202 Accepted**, et un worker traite. 202 et
 * non 200 : le code dit la vérité, « j'ai reçu et je m'en occupe », pas « c'est fait ».
 *
 * DÉDUPLICATION PAR CONTRAINTE, PAS PAR CODE. La clé d'idempotence est UNIQUE en base.
 * Un test « existe-t-il déjà ? » suivi d'une insertion laisse une fenêtre où deux
 * webhooks jumeaux passent tous les deux. La base, elle, ne se trompe pas.
 */

const db = require('../../db');
const logger = require('../logger');
const { IntegrationError } = require('./errors');

const STATUS = {
  RECEIVED: 'received',
  PROCESSED: 'processed',
  /** Refusé pour une raison de fond : voir `sync_conflicts`. Ne sera pas réessayé. */
  REJECTED: 'rejected',
  /** Échec technique répété. */
  DEAD: 'dead',
};

const MAX_ATTEMPTS = 5;
const BASE_BACKOFF_SECONDS = 10;

db.exec(`
  CREATE TABLE IF NOT EXISTS integration_inbox (
    id TEXT PRIMARY KEY,
    connector_id TEXT NOT NULL,
    store_id TEXT,
    resource TEXT NOT NULL,
    -- Charge BRUTE, dans le dialecte de l'éditeur. La traduction en vocabulaire Ma Zone
    -- a lieu au traitement : garder l'original permet de rejouer un message après correction
    -- d'un mapping, ce qui est le cas le plus fréquent d'incident d'intégration.
    payload TEXT NOT NULL,
    idempotency_key TEXT NOT NULL UNIQUE,
    source_updated_at TEXT,
    correlation_id TEXT,
    status TEXT NOT NULL DEFAULT 'received',
    attempts INTEGER NOT NULL DEFAULT 0,
    next_attempt_at TEXT NOT NULL DEFAULT (datetime('now')),
    last_error TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    processed_at TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_inbox_due
    ON integration_inbox(status, next_attempt_at);
  CREATE INDEX IF NOT EXISTS idx_inbox_store
    ON integration_inbox(store_id, created_at DESC);
`);

/**
 * Accepte un message entrant.
 *
 * @returns {{ message: object, accepted: boolean }} `accepted: false` sur un doublon —
 *          ce n'est pas une erreur, c'est le mécanisme qui fonctionne.
 */
function accept({
  connectorId, storeId = null, resource, payload,
  idempotencyKey, sourceUpdatedAt = null, correlationId = null,
}) {
  if (!connectorId || !resource) {
    throw new IntegrationError('Message entrant incomplet.', 400);
  }
  if (!idempotencyKey) {
    throw new IntegrationError(
      'Un message entrant sans clé d\'idempotence ne peut pas être dédupliqué.',
      400
    );
  }

  const id = db.generateId();
  const info = db.prepare(`
    INSERT OR IGNORE INTO integration_inbox
      (id, connector_id, store_id, resource, payload, idempotency_key,
       source_updated_at, correlation_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, connectorId, storeId, resource, JSON.stringify(payload ?? {}),
    idempotencyKey, sourceUpdatedAt, correlationId
  );

  if (info.changes === 0) {
    const existing = db
      .prepare('SELECT * FROM integration_inbox WHERE idempotency_key = ?')
      .get(idempotencyKey);
    return { message: parse(existing), accepted: false };
  }

  return { message: parse(get(id)), accepted: true };
}

/** Messages à traiter, les plus anciens d'abord (l'ordre de la source est significatif). */
function due(limit = 50) {
  return db.prepare(`
    SELECT * FROM integration_inbox
    WHERE status = ? AND datetime(next_attempt_at) <= datetime('now')
    ORDER BY created_at ASC, rowid ASC
    LIMIT ?
  `).all(STATUS.RECEIVED, limit).map(parse);
}

function markProcessed(id) {
  db.prepare(`
    UPDATE integration_inbox
    SET status = ?, processed_at = datetime('now'), last_error = NULL
    WHERE id = ?
  `).run(STATUS.PROCESSED, id);
}

/**
 * Refus définitif.
 *
 * Séparé de l'échec technique parce que réessayer n'a aucun sens : un message qui
 * propose d'écrire `reserved` le proposera encore dans dix minutes. Le conflit a été
 * journalisé, le message est classé, et le commerçant peut le lire.
 */
function markRejected(id, reason) {
  db.prepare(`
    UPDATE integration_inbox
    SET status = ?, processed_at = datetime('now'), last_error = ?
    WHERE id = ?
  `).run(STATUS.REJECTED, String(reason).slice(0, 500), id);
}

function markFailed(id, error) {
  const row = get(id);
  if (!row) return null;

  const attempts = row.attempts + 1;
  const exhausted = attempts >= MAX_ATTEMPTS;
  const delay = BASE_BACKOFF_SECONDS * (2 ** (attempts - 1));

  db.prepare(`
    UPDATE integration_inbox
    SET attempts = ?, status = ?, last_error = ?, next_attempt_at = datetime('now', ?)
    WHERE id = ?
  `).run(
    attempts,
    exhausted ? STATUS.DEAD : STATUS.RECEIVED,
    String(error?.message || error || 'échec inconnu').slice(0, 500),
    `+${delay} seconds`,
    id
  );

  if (exhausted) {
    logger.warn('Message entrant en lettre morte', {
      id, connectorId: row.connector_id, resource: row.resource, attempts,
    });
  }

  return { attempts, dead: exhausted };
}

function get(id) {
  return db.prepare('SELECT * FROM integration_inbox WHERE id = ?').get(id) || null;
}

function stats() {
  const rows = db
    .prepare('SELECT status, COUNT(*) AS n FROM integration_inbox GROUP BY status')
    .all();
  const counts = { received: 0, processed: 0, rejected: 0, dead: 0 };
  for (const row of rows) counts[row.status] = row.n;
  return counts;
}

function forStore(storeId, { limit = 50 } = {}) {
  return db.prepare(`
    SELECT * FROM integration_inbox WHERE store_id = ?
    ORDER BY created_at DESC, rowid DESC LIMIT ?
  `).all(storeId, limit).map(parse);
}

function parse(row) {
  if (!row) return null;
  let payload = null;
  try {
    payload = JSON.parse(row.payload);
  } catch {
    payload = row.payload;
  }
  return { ...row, payload };
}

module.exports = {
  STATUS,
  MAX_ATTEMPTS,
  BASE_BACKOFF_SECONDS,
  accept,
  due,
  markProcessed,
  markRejected,
  markFailed,
  get,
  stats,
  forStore,
};
