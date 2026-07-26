/**
 * Integration Engine — journal des conflits de synchronisation.
 *
 * PAS DE LAST-WRITE-WINS GLOBAL. C'est la règle qui distingue une synchronisation d'un
 * écrasement mutuel. Chaque attribut a un propriétaire (Loi 3) ; une écriture venue
 * d'ailleurs n'est pas « la plus récente », elle est **refusée et racontée**.
 *
 * Ce que le silence coûterait. Un commerçant dont le stock devient faux sans trace ne
 * peut rien faire : il ne sait pas quand, ni d'où, ni pourquoi. Il conclut que Ma Zone
 * est cassée, et il a raison de le conclure. Un conflit journalisé transforme ce
 * mystère en phrase : « le 12 à 14h03, votre caisse a proposé 8, Ma Zone a gardé 5,
 * parce que le message était plus ancien que la dernière correction. »
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * CE FICHIER N'ARBITRE PAS LA PROPRIÉTÉ MÉTIER, ET C'EST UNE FRONTIÈRE FINE.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * « Qui possède `on_hand` sur cette boutique » est une question d'INVENTORY, qui y répond
 * déjà par `inventory_owner` (étape 4). « Ce message est-il en retard » et « cette source
 * a-t-elle le droit d'écrire cet attribut » sont des questions de SYNCHRONISATION, donc
 * les nôtres. Rejouer la décision d'Inventory ici créerait deux vérités sur la même
 * question, et un jour elles divergeraient.
 *
 * En pratique : le moteur propose l'écriture à l'organe. Si l'organe refuse, ce refus
 * devient un conflit. On ne devine jamais le refus à sa place.
 */

const db = require('../../db');

/** Raisons de refus. Fermées : une raison inconnue serait une raison inexploitable. */
const REASON = {
  /** L'attribut appartient à une autre source (Loi 3). */
  OWNER_PRIORITY: 'owner_priority',
  /** Message plus ancien que le dernier appliqué. */
  STALE_TIMESTAMP: 'stale_timestamp',
  /** Attribut immuable après publication (sku, ean). */
  IMMUTABLE: 'immutable',
  /** Attribut calculé : personne ne l'écrit (Loi 11). */
  COMPUTED_FIELD: 'computed_field',
  /** Aucune correspondance connue pour cette entité externe. */
  UNMAPPED_ENTITY: 'unmapped_entity',
  /** L'organe a refusé pour une raison qui lui appartient. */
  ORGAN_REFUSED: 'organ_refused',
};

const REASONS = Object.values(REASON);

/**
 * Attributs que Ma Zone ne laisse écrire à personne d'autre qu'elle.
 *
 * `reserved` est le cas d'école : aucune caisse au monde ne sait ce que Ma Zone a promis
 * à un client. Une caisse qui prétend connaître `reserved` se trompe, même de bonne foi.
 * `available` est calculé (Loi 11) : le proposer est une erreur de conception du
 * connecteur, pas un conflit de données.
 */
const NEVER_WRITABLE_BY_CONNECTOR = {
  reserved: REASON.OWNER_PRIORITY,
  available: REASON.COMPUTED_FIELD,
  safety_buffer: REASON.OWNER_PRIORITY,
};

db.exec(`
  CREATE TABLE IF NOT EXISTS sync_conflicts (
    id TEXT PRIMARY KEY,
    connector_id TEXT NOT NULL,
    store_id TEXT,
    mazone_entity_type TEXT,
    mazone_id TEXT,
    external_id TEXT,
    attribute TEXT NOT NULL,
    proposed_value TEXT,
    retained_value TEXT,
    losing_source TEXT NOT NULL,
    reason TEXT NOT NULL,
    -- Résumé, pas copie : un payload complet d'éditeur peut contenir des données
    -- personnelles qu'on n'a aucune raison de conserver dans un journal technique.
    payload_summary TEXT,
    source_updated_at TEXT,
    -- Un conflit se lit, se comprend, et se marque comme vu. Sans cela le journal
    -- devient un mur de bruit que plus personne ne regarde.
    acknowledged_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_sync_conflicts_store
    ON sync_conflicts(store_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_sync_conflicts_entity
    ON sync_conflicts(mazone_entity_type, mazone_id);
`);

/**
 * Enregistre un conflit.
 *
 * Appelable dans la transaction du traitement : un conflit détecté puis perdu par un
 * rollback laisserait le commerçant avec un stock inexpliqué et aucune trace.
 */
function record({
  connectorId, storeId = null, entityType = null, mazoneId = null, externalId = null,
  attribute, proposedValue = null, retainedValue = null,
  losingSource, reason, payloadSummary = null, sourceUpdatedAt = null,
}) {
  if (!REASONS.includes(reason)) {
    throw new Error(`[Integration] raison de conflit inconnue « ${reason} »`);
  }

  const id = db.generateId();
  db.prepare(`
    INSERT INTO sync_conflicts
      (id, connector_id, store_id, mazone_entity_type, mazone_id, external_id, attribute,
       proposed_value, retained_value, losing_source, reason, payload_summary, source_updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, connectorId, storeId, entityType, mazoneId, externalId, attribute,
    stringify(proposedValue), stringify(retainedValue), losingSource, reason,
    payloadSummary === null ? null : JSON.stringify(payloadSummary), sourceUpdatedAt
  );

  return id;
}

/**
 * Un connecteur a-t-il le droit de proposer cet attribut ?
 *
 * Répond `null` si oui, la raison du refus sinon. Ne consulte AUCUN organe : il ne
 * s'agit pas de savoir qui possède le stock de cette boutique, mais si l'attribut est
 * par nature hors de portée d'une source externe.
 */
function refusalFor(attribute) {
  return NEVER_WRITABLE_BY_CONNECTOR[attribute] || null;
}

function stringify(value) {
  if (value === null || value === undefined) return null;
  return typeof value === 'string' ? value : JSON.stringify(value);
}

/**
 * Conflits d'une boutique, du plus récent au plus ancien.
 *
 * `connectorId` ajouté à l'étape 7 pour `/api/v1/integrations/:connectorId/conflicts`.
 * Filtrer dans l'appelant aurait marché sur cinquante lignes et aurait cessé de marcher
 * au moment exact où ça compte : une boutique dont un connecteur part en boucle d'erreurs
 * remplit la table, et la limite renverrait alors cinquante conflits d'un autre logiciel.
 */
function forStore(storeId, { limit = 50, unacknowledgedOnly = false, connectorId = null } = {}) {
  const clauses = [
    unacknowledgedOnly ? 'AND acknowledged_at IS NULL' : '',
    connectorId ? 'AND connector_id = ?' : '',
  ].join(' ');

  const params = connectorId ? [storeId, connectorId, limit] : [storeId, limit];

  return db.prepare(`
    SELECT * FROM sync_conflicts
    WHERE store_id = ? ${clauses}
    ORDER BY created_at DESC, rowid DESC
    LIMIT ?
  `).all(...params);
}

/** Marque un conflit comme vu. */
function acknowledge(conflictId) {
  const info = db.prepare(`
    UPDATE sync_conflicts SET acknowledged_at = datetime('now')
    WHERE id = ? AND acknowledged_at IS NULL
  `).run(conflictId);
  return info.changes > 0;
}

/** Compteur destiné à une pastille d'alerte dans l'Épée. */
function pendingCount(storeId) {
  const row = db.prepare(`
    SELECT COUNT(*) AS n FROM sync_conflicts WHERE store_id = ? AND acknowledged_at IS NULL
  `).get(storeId);
  return row.n;
}

module.exports = {
  REASON,
  REASONS,
  NEVER_WRITABLE_BY_CONNECTOR,
  record,
  refusalFor,
  forStore,
  acknowledge,
  pendingCount,
};
