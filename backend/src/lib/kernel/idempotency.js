/**
 * Noyau — idempotence aux frontières.
 *
 * LOI 10 — REJOUER NE CHANGE RIEN.
 * Toute intention, tout webhook entrant et tout effet sortant portent une clé
 * d'idempotence. Généralisation du mécanisme déjà présent dans
 * `walletEngine.consumeObject` et `identityEngine.verifyPresentation`.
 *
 * Le problème réel : un client mobile qui perd le réseau juste après avoir envoyé
 * `POST /api/orders` ne sait pas si la commande existe. Il réessaie. Sans clé
 * d'idempotence, il vient d'acheter deux fois.
 *
 * Ce module ne connaît AUCUN métier. Il répond à une seule question : « cette clé
 * a-t-elle déjà produit un résultat, et lequel ».
 */

const db = require('../../db');

const DEFAULT_TTL_HOURS = 24 * 7;

db.exec(`
  CREATE TABLE IF NOT EXISTS idempotency_keys (
    scope TEXT NOT NULL,
    key TEXT NOT NULL,
    actor TEXT,
    -- Empreinte de la requête : détecte une même clé réutilisée pour une
    -- requête différente, ce qui est un bug d'appelant, pas un rejeu.
    fingerprint TEXT,
    result TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    expires_at TEXT NOT NULL,
    PRIMARY KEY (scope, key)
  );

  CREATE INDEX IF NOT EXISTS idx_idempotency_expiry ON idempotency_keys(expires_at);
`);

class IdempotencyConflictError extends Error {
  constructor(scope, key) {
    super(
      `La clé d'idempotence « ${key} » a déjà été utilisée pour une requête différente.`
    );
    this.name = 'IdempotencyConflictError';
    this.scope = scope;
    this.key = key;
    this.status = 409;
  }
}

/** Empreinte stable d'une charge utile : clés triées pour être insensible à l'ordre. */
function fingerprint(payload) {
  if (payload === undefined || payload === null) return null;
  return stableStringify(payload);
}

function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(',')}}`;
}

/**
 * Résultat déjà enregistré pour cette clé, ou `null`.
 *
 * @throws {IdempotencyConflictError} si la clé a servi pour une autre requête
 */
function lookup(scope, key, { payload } = {}) {
  if (!key) return null;

  const row = db
    .prepare(`
      SELECT * FROM idempotency_keys
      WHERE scope = ? AND key = ? AND datetime(expires_at) > datetime('now')
    `)
    .get(scope, key);

  if (!row) return null;

  const expected = fingerprint(payload);
  if (expected !== null && row.fingerprint !== null && row.fingerprint !== expected) {
    throw new IdempotencyConflictError(scope, key);
  }

  return {
    found: true,
    result: row.result === null ? null : JSON.parse(row.result),
    createdAt: row.created_at,
  };
}

/**
 * Enregistre le résultat d'une opération. À appeler DANS la transaction de
 * l'opération : une clé enregistrée sur une transaction annulée bloquerait pour
 * toujours une opération qui n'a jamais eu lieu.
 */
function remember(scope, key, result, { payload, actor = null, ttlHours = DEFAULT_TTL_HOURS } = {}) {
  if (!key) return;

  db.prepare(`
    INSERT INTO idempotency_keys (scope, key, actor, fingerprint, result, expires_at)
    VALUES (?, ?, ?, ?, ?, datetime('now', ?))
    ON CONFLICT (scope, key) DO UPDATE SET
      result = excluded.result,
      fingerprint = COALESCE(idempotency_keys.fingerprint, excluded.fingerprint)
  `).run(
    scope,
    key,
    actor,
    fingerprint(payload),
    result === undefined ? null : JSON.stringify(result),
    // SQLite refuse un modificateur « +-1 hours » : le signe est explicite.
    `${ttlHours < 0 ? '' : '+'}${ttlHours} hours`
  );
}

/**
 * Exécute `operation` une seule fois pour une clé donnée.
 *
 * Sans clé, l'opération est simplement exécutée : l'idempotence est une garantie
 * offerte à l'appelant, pas une obligation imposée à tous les appels internes.
 *
 * @template T
 * @param {string} scope
 * @param {string|null} key
 * @param {{ payload?: any, actor?: string|null, ttlHours?: number }} options
 * @param {() => T} operation
 * @returns {{ result: T, replayed: boolean }}
 */
function once(scope, key, options, operation) {
  if (!key) return { result: operation(), replayed: false };

  const prior = lookup(scope, key, options);
  if (prior) return { result: prior.result, replayed: true };

  const result = operation();
  remember(scope, key, result, options);
  return { result, replayed: false };
}

/** Purge des clés expirées. Appelée par une tâche planifiée, jamais dans un flux. */
function purgeExpired() {
  const info = db
    .prepare("DELETE FROM idempotency_keys WHERE datetime(expires_at) <= datetime('now')")
    .run();
  return info.changes;
}

module.exports = {
  lookup,
  remember,
  once,
  purgeExpired,
  fingerprint,
  IdempotencyConflictError,
  DEFAULT_TTL_HOURS,
};
