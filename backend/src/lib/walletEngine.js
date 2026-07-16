/**
 * Wallet Engine — Registre personnel des objets numériques du citoyen.
 *
 * Organe transversal : consommé par les autres moteurs (Marketing, Event,
 * Orders...), dépendant d'aucun. Il stocke et GOUVERNE le cycle de vie des
 * objets numériques, sans jamais connaître leur sens métier (payload opaque).
 *
 * Couche dure (entitlement)  : transitions d'état atomiques et journalisées.
 * Couche souple (présentation) : capacités et facette souvenir, via le registre.
 *
 * Règles non négociables appliquées ici :
 *  - Générique, piloté par le registre (aucun `if (kind === ...)` métier).
 *  - Journal append-only pour chaque transition (auditabilité + biographie).
 *  - Consommation idempotente et atomique.
 *  - Accès uniquement via cette interface publique (pas d'accès DB direct
 *    par les autres organes).
 */

const db = require('../db');
const registry = require('./walletRegistry');

const { OBJECT_STATUS, EVENT_TYPE } = registry;

// ── Utilitaires internes ──────────────────────────────────────────────────────

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function safeParse(json) {
  if (!json) return null;
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function getRawObject(objectId) {
  return db.prepare('SELECT * FROM digital_objects WHERE id = ?').get(objectId);
}

/**
 * Projette une ligne brute en objet numérique enrichi (label, capacités,
 * facette souvenir). Le payload reste tel quel : le moteur ne l'interprète pas.
 */
function rowToObject(row) {
  if (!row) return null;
  const def = registry.getKind(row.kind);
  const isTerminal = registry.TERMINAL_STATUS.includes(row.status);
  const isMemory = isTerminal && !!def?.memoryEnabled && row.retention !== registry.RETENTION.ENTITLEMENT_ONLY;
  return {
    id: row.id,
    ownerId: row.owner_id,
    kind: row.kind,
    label: def?.label || row.kind,
    family: row.family,
    status: row.status,
    retention: row.retention,
    payload: safeParse(row.payload),
    display: safeParse(row.display),
    sourceEngine: row.source_engine,
    sourceRef: row.source_ref,
    zoneId: row.zone_id,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    isMemory,
    capabilities: registry.getCapabilities(row.kind, row.status),
  };
}

/**
 * Applique une transition d'état : met à jour la projection ET inscrit
 * l'événement au journal. À appeler UNIQUEMENT dans une transaction.
 */
function transitionRaw(obj, toStatus, { type, actorEngine = null, idempotencyKey = null, payload = null }) {
  db.prepare(
    "UPDATE digital_objects SET status = ?, updated_at = datetime('now') WHERE id = ?"
  ).run(toStatus, obj.id);
  db.prepare(`
    INSERT INTO digital_object_events
      (id, object_id, type, from_status, to_status, payload, actor_engine, idempotency_key)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    db.generateId(),
    obj.id,
    type,
    obj.status,
    toStatus,
    payload ? JSON.stringify(payload) : null,
    actorEngine,
    idempotencyKey
  );
}

function emitWalletUpdate(io, ownerId, event, rawObj) {
  if (!io || !ownerId) return;
  io.to(`user_${ownerId}`).emit(event, { object: rowToObject(rawObj) });
}

// ── Commandes (écritures gouvernées) ──────────────────────────────────────────

/**
 * Émet un nouvel objet numérique dans le Wallet d'un citoyen.
 * Appelé par un organe émetteur (Event, Orders, Marketing...).
 */
function issueObject(params, io) {
  const {
    ownerId,
    kind,
    payload = null,
    display = null,
    sourceEngine,
    sourceRef = null,
    zoneId = null,
    expiresAt = null,
  } = params || {};

  if (!ownerId) throw httpError(400, 'ownerId requis');
  if (!kind || !registry.isKnownKind(kind)) throw httpError(400, `Type d'objet inconnu : ${kind}`);
  if (!sourceEngine) throw httpError(400, 'sourceEngine requis');

  const owner = db.prepare('SELECT id FROM users WHERE id = ?').get(ownerId);
  if (!owner) throw httpError(404, 'Propriétaire introuvable');

  const id = db.generateId();
  const status = registry.getInitialStatus(kind);
  const family = registry.getFamilyOfKind(kind);
  const retention = registry.getRetention(kind);

  const created = db.transaction(() => {
    db.prepare(`
      INSERT INTO digital_objects
        (id, owner_id, kind, family, status, retention, payload, display, source_engine, source_ref, zone_id, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, ownerId, kind, family, status, retention,
      payload ? JSON.stringify(payload) : null,
      display ? JSON.stringify(display) : null,
      sourceEngine, sourceRef, zoneId, expiresAt
    );

    db.prepare(`
      INSERT INTO digital_object_events (id, object_id, type, from_status, to_status, actor_engine)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(db.generateId(), id, EVENT_TYPE.ISSUED, null, status, sourceEngine);

    return getRawObject(id);
  })();

  if (io) emitWalletUpdate(io, ownerId, 'wallet:object_issued', created);
  return rowToObject(created);
}

/**
 * Consomme un objet (usage de son droit). Idempotent via `idempotencyKey` :
 * rejouer la même consommation ne double jamais l'effet.
 */
function consumeObject({ objectId, consumerEngine, idempotencyKey = null }, io) {
  if (!objectId) throw httpError(400, 'objectId requis');

  const result = db.transaction(() => {
    const obj = getRawObject(objectId);
    if (!obj) throw httpError(404, 'Objet introuvable');

    if (idempotencyKey) {
      const existing = db
        .prepare('SELECT id FROM digital_object_events WHERE object_id = ? AND idempotency_key = ?')
        .get(objectId, idempotencyKey);
      if (existing) return { object: getRawObject(objectId), replayed: true };
    }

    if (obj.status === OBJECT_STATUS.CONSUMED) throw httpError(409, 'Objet déjà consommé');

    const def = registry.getKind(obj.kind);
    if (def && def.consumable === false) throw httpError(409, 'Cet objet ne peut pas être consommé');
    if (!registry.canTransition(obj.kind, obj.status, OBJECT_STATUS.CONSUMED)) {
      throw httpError(409, `Transition non autorisée : ${obj.status} → consumed`);
    }

    transitionRaw(obj, OBJECT_STATUS.CONSUMED, {
      type: EVENT_TYPE.CONSUMED,
      actorEngine: consumerEngine || null,
      idempotencyKey,
    });
    return { object: getRawObject(objectId), replayed: false };
  })();

  if (io && !result.replayed) {
    emitWalletUpdate(io, result.object.owner_id, 'wallet:object_consumed', result.object);
  }
  return rowToObject(result.object);
}

/**
 * Révoque un objet (retiré par l'organe émetteur). Le ledger conserve la trace.
 */
function revokeObject({ objectId, reason = null, actorEngine }, io) {
  if (!objectId) throw httpError(400, 'objectId requis');

  const updated = db.transaction(() => {
    const obj = getRawObject(objectId);
    if (!obj) throw httpError(404, 'Objet introuvable');
    if (obj.status === OBJECT_STATUS.REVOKED) return getRawObject(objectId);
    if (!registry.canTransition(obj.kind, obj.status, OBJECT_STATUS.REVOKED)) {
      throw httpError(409, `Transition non autorisée : ${obj.status} → revoked`);
    }
    transitionRaw(obj, OBJECT_STATUS.REVOKED, {
      type: EVENT_TYPE.REVOKED,
      actorEngine: actorEngine || null,
      payload: reason ? { reason } : null,
    });
    return getRawObject(objectId);
  })();

  if (io) emitWalletUpdate(io, updated.owner_id, 'wallet:object_revoked', updated);
  return rowToObject(updated);
}

// ── Requêtes (lectures) ───────────────────────────────────────────────────────

function getObjectsByOwner(ownerId, filters = {}) {
  let sql = 'SELECT * FROM digital_objects WHERE owner_id = ?';
  const args = [ownerId];
  if (filters.family) {
    sql += ' AND family = ?';
    args.push(filters.family);
  }
  if (filters.kind) {
    sql += ' AND kind = ?';
    args.push(filters.kind);
  }
  if (filters.status) {
    sql += ' AND status = ?';
    args.push(filters.status);
  }
  sql += ' ORDER BY updated_at DESC';
  return db.prepare(sql).all(...args).map(rowToObject);
}

/**
 * Vue du Wallet organisée par familles d'objets (pour l'écran principal).
 * Regroupement de présentation, jamais de logique métier.
 */
function getWalletByFamilies(ownerId) {
  const objects = getObjectsByOwner(ownerId);
  return registry.getFamilies().map((fam) => {
    const items = objects.filter((o) => o.family === fam.id);
    return {
      id: fam.id,
      label: fam.label,
      icon: fam.icon,
      color: fam.color,
      count: items.length,
      activeCount: items.filter((o) => o.status === OBJECT_STATUS.ACTIVE).length,
      items,
    };
  });
}

function getObjectById(objectId, ownerId = null) {
  const obj = getRawObject(objectId);
  if (!obj) throw httpError(404, 'Objet introuvable');
  if (ownerId && obj.owner_id !== ownerId) throw httpError(403, 'Accès refusé');
  return rowToObject(obj);
}

function getCapabilitiesForObject(objectId, ownerId = null) {
  const obj = getRawObject(objectId);
  if (!obj) throw httpError(404, 'Objet introuvable');
  if (ownerId && obj.owner_id !== ownerId) throw httpError(403, 'Accès refusé');
  return registry.getCapabilities(obj.kind, obj.status);
}

/**
 * Biographie de l'objet : journal append-only complet (ledger).
 */
function getObjectEvents(objectId, ownerId = null) {
  const obj = getRawObject(objectId);
  if (!obj) throw httpError(404, 'Objet introuvable');
  if (ownerId && obj.owner_id !== ownerId) throw httpError(403, 'Accès refusé');
  return db
    .prepare('SELECT * FROM digital_object_events WHERE object_id = ? ORDER BY created_at ASC')
    .all(objectId)
    .map((e) => ({
      id: e.id,
      type: e.type,
      fromStatus: e.from_status,
      toStatus: e.to_status,
      payload: safeParse(e.payload),
      actorEngine: e.actor_engine,
      createdAt: e.created_at,
    }));
}

module.exports = {
  // Commandes
  issueObject,
  consumeObject,
  revokeObject,
  // Requêtes
  getObjectsByOwner,
  getWalletByFamilies,
  getObjectById,
  getCapabilitiesForObject,
  getObjectEvents,
  // Métadonnées du registre (lecture)
  getFamilies: registry.getFamilies,
  listKinds: registry.listKinds,
};
