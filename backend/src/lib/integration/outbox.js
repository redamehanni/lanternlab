/**
 * Integration Engine — file sortante.
 *
 * Une décision de Ma Zone qui doit atteindre un logiciel tiers passe TOUJOURS par ici.
 * Jamais par un appel direct.
 *
 * POURQUOI UNE FILE PLUTÔT QU'UN APPEL. Un appel réseau échoue. Il échoue au mauvais
 * moment — pendant que le client attend sa confirmation — et pour des raisons qui n'ont
 * rien à voir avec la vente : un jeton expiré, une maintenance chez l'éditeur, une
 * coupure de trois secondes. Sans file, il ne reste que deux comportements, et les deux
 * sont mauvais : refuser la vente parce qu'un logiciel tiers est indisponible, ou
 * l'accepter en perdant l'information sans le dire à personne.
 *
 * Avec une file : la vente est acquise, la transmission est une promesse tenue plus tard,
 * et ce qui n'a pas encore abouti est visible. C'est aussi la seule façon de respecter la
 * LOI 7 — aucune I/O réseau dans une transaction. Écrire une ligne dans une table, ça se
 * fait dans la transaction de la décision. Appeler un éditeur, non.
 *
 * GARANTIE : AU MOINS UNE FOIS, jamais exactement une fois. Un message peut partir deux
 * fois si le worker meurt entre l'envoi et la marque. C'est pour cela que chaque message
 * porte une clé d'idempotence que le destinataire doit honorer — et pour cela que la
 * garantie est écrite ici noir sur blanc plutôt que supposée.
 */

const db = require('../../db');
const logger = require('../logger');
const { IntegrationError } = require('./errors');

const STATUS = {
  PENDING: 'pending',
  SENT: 'sent',
  /**
   * Lettre morte. Le message a épuisé ses tentatives.
   *
   * Un statut plutôt qu'une table séparée : une table `outbox_failed` obligerait à
   * recopier le schéma, ferait perdre l'historique des tentatives, et poserait la
   * question de savoir laquelle des deux tables consulter. Ici, un message mort reste à
   * côté de ses frères, avec la trace de tout ce qui a été essayé.
   */
  DEAD: 'dead',
};

/**
 * Après 6 tentatives — environ 30 minutes de réessais — le problème n'est plus
 * passager. Continuer indéfiniment ne réparerait rien et masquerait la panne derrière un
 * bruit de fond permanent.
 */
const MAX_ATTEMPTS = 6;
const BASE_BACKOFF_SECONDS = 15;

db.exec(`
  CREATE TABLE IF NOT EXISTS integration_outbox (
    id TEXT PRIMARY KEY,
    store_id TEXT NOT NULL,
    connector_id TEXT NOT NULL,
    resource TEXT NOT NULL,
    operation TEXT NOT NULL,
    -- Charge CANONIQUE (CDM). La traduction vers le dialecte de l'éditeur est faite par
    -- le connecteur au moment de l'envoi, pas à l'enfilement : un connecteur mis à jour
    -- doit pouvoir renvoyer un message enfilé avant sa mise à jour.
    payload TEXT NOT NULL,
    idempotency_key TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'pending',
    attempts INTEGER NOT NULL DEFAULT 0,
    next_attempt_at TEXT NOT NULL DEFAULT (datetime('now')),
    last_error TEXT,
    external_ref TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    sent_at TEXT
  );

  -- Index de travail du worker : il ne cherche jamais autre chose que « ce qui est dû ».
  CREATE INDEX IF NOT EXISTS idx_outbox_due
    ON integration_outbox(status, next_attempt_at);
  CREATE INDEX IF NOT EXISTS idx_outbox_store
    ON integration_outbox(store_id, created_at DESC);
`);

/**
 * Enfile un message.
 *
 * Sûr à appeler DANS la transaction d'une décision métier : c'est une simple écriture,
 * et `txn.run` imbriqué rejoint la transaction du parent. Si la décision est annulée,
 * le message disparaît avec elle — ce qui est exactement le comportement voulu, un
 * message ne doit jamais parler d'une vente qui n'a pas eu lieu.
 *
 * La clé d'idempotence est OBLIGATOIRE et porte la garantie anti-doublon : réenfiler la
 * même clé ne crée pas un second message. Sans elle, une intention rejouée pousserait
 * deux fois la même vente chez l'éditeur.
 */
function enqueue({ storeId, connectorId, resource, operation, payload, idempotencyKey }) {
  if (!storeId || !connectorId || !resource || !operation) {
    throw new IntegrationError('Message sortant incomplet.', 400);
  }
  if (!idempotencyKey) {
    throw new IntegrationError(
      'Un message sortant sans clé d\'idempotence finirait par être envoyé deux fois.',
      400
    );
  }

  const existing = db
    .prepare('SELECT * FROM integration_outbox WHERE idempotency_key = ?')
    .get(idempotencyKey);
  if (existing) return { message: parse(existing), enqueued: false };

  const id = db.generateId();
  db.prepare(`
    INSERT INTO integration_outbox
      (id, store_id, connector_id, resource, operation, payload, idempotency_key)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, storeId, connectorId, resource, operation, JSON.stringify(payload ?? {}), idempotencyKey);

  return { message: parse(get(id)), enqueued: true };
}

/**
 * Messages dus, les plus anciens d'abord.
 *
 * L'ordre est important : deux messages sur la même entité doivent arriver dans l'ordre
 * où Ma Zone les a décidés. Une vente puis son annulation, inversées, laisseraient
 * l'éditeur avec une vente fantôme.
 */
function due(limit = 50) {
  return db.prepare(`
    SELECT * FROM integration_outbox
    WHERE status = ? AND datetime(next_attempt_at) <= datetime('now')
    ORDER BY created_at ASC, rowid ASC
    LIMIT ?
  `).all(STATUS.PENDING, limit).map(parse);
}

function markSent(id, externalRef = null) {
  db.prepare(`
    UPDATE integration_outbox
    SET status = ?, sent_at = datetime('now'), external_ref = ?, last_error = NULL
    WHERE id = ?
  `).run(STATUS.SENT, externalRef, id);
}

/**
 * Enregistre un échec et programme le prochain essai.
 *
 * Backoff exponentiel : 15 s, 30 s, 1 min, 2 min, 4 min, 8 min. Un réessai immédiat en
 * boucle transformerait une panne de l'éditeur en attaque involontaire contre lui — et
 * ferait tourner notre worker à vide au lieu de traiter le reste de la file.
 */
function markFailed(id, error) {
  const row = get(id);
  if (!row) return null;

  const attempts = row.attempts + 1;
  const exhausted = attempts >= MAX_ATTEMPTS;
  const delay = BASE_BACKOFF_SECONDS * (2 ** (attempts - 1));

  db.prepare(`
    UPDATE integration_outbox
    SET attempts = ?, status = ?, last_error = ?,
        next_attempt_at = datetime('now', ?)
    WHERE id = ?
  `).run(
    attempts,
    exhausted ? STATUS.DEAD : STATUS.PENDING,
    String(error?.message || error || 'échec inconnu').slice(0, 500),
    `+${delay} seconds`,
    id
  );

  if (exhausted) {
    // Une lettre morte est un événement d'exploitation, pas un détail : quelqu'un doit
    // pouvoir la voir sans lire la base.
    logger.warn('Message sortant en lettre morte', {
      id, connectorId: row.connector_id, resource: row.resource, attempts,
    });
  }

  return { attempts, dead: exhausted };
}

/**
 * Classe un message définitivement, sans passer par les réessais.
 *
 * Pour les échecs dont on sait qu'ils ne guériront pas d'eux-mêmes : le connecteur a été
 * retiré du code, la boutique l'a débranché. Réessayer six fois sur trente minutes ne
 * ferait que noyer les vraies pannes passagères dans du bruit.
 */
function bury(id, reason) {
  db.prepare(`
    UPDATE integration_outbox SET status = ?, last_error = ? WHERE id = ? AND status = ?
  `).run(STATUS.DEAD, String(reason).slice(0, 500), id, STATUS.PENDING);
}

/**
 * Remet une lettre morte dans la file.
 *
 * Le compteur repart à zéro : un opérateur qui relance a corrigé quelque chose, il ne
 * demande pas une septième tentative de la même chose.
 */
function revive(id) {
  const info = db.prepare(`
    UPDATE integration_outbox
    SET status = ?, attempts = 0, next_attempt_at = datetime('now'), last_error = NULL
    WHERE id = ? AND status = ?
  `).run(STATUS.PENDING, id, STATUS.DEAD);
  return info.changes > 0;
}

function get(id) {
  return db.prepare('SELECT * FROM integration_outbox WHERE id = ?').get(id) || null;
}

/** Lettres mortes, toutes boutiques ou une seule. */
function deadLetters({ storeId = null, limit = 50 } = {}) {
  const rows = storeId
    ? db.prepare(`
        SELECT * FROM integration_outbox WHERE status = ? AND store_id = ?
        ORDER BY created_at DESC LIMIT ?
      `).all(STATUS.DEAD, storeId, limit)
    : db.prepare(`
        SELECT * FROM integration_outbox WHERE status = ?
        ORDER BY created_at DESC LIMIT ?
      `).all(STATUS.DEAD, limit);
  return rows.map(parse);
}

/**
 * État de la file. `pending` est le chiffre à surveiller : la roadmap fixe le seuil de
 * réexamen Postgres à plus de 200 messages en attente de façon soutenue.
 */
function stats() {
  const rows = db
    .prepare('SELECT status, COUNT(*) AS n FROM integration_outbox GROUP BY status')
    .all();
  const counts = { pending: 0, sent: 0, dead: 0 };
  for (const row of rows) counts[row.status] = row.n;
  return counts;
}

/** Messages d'une boutique — destiné à l'écran « Mes intégrations ». */
function forStore(storeId, { limit = 50 } = {}) {
  return db.prepare(`
    SELECT * FROM integration_outbox WHERE store_id = ?
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
  enqueue,
  due,
  markSent,
  markFailed,
  bury,
  revive,
  get,
  deadLetters,
  stats,
  forStore,
};
