/**
 * Identity Engine — Preuve d'identité présentable et vérifiable du citoyen.
 *
 * Organe transversal : consommé par les autres moteurs (Event, Orders...),
 * dépendant d'AUCUN. Sa seule responsabilité est de répondre avec certitude à
 * la question « Qui est cette personne ? ». Il n'accorde jamais un droit, ne
 * prend aucune décision métier, ne connaît ni billet, ni commande, ni promotion.
 *
 * Sécurité (Approche C) : le jeton présenté est un `handle` opaque aléatoire,
 * court, à usage unique et rotatif. La vérification est faite côté serveur ; le
 * handle ne contient aucun secret. Le canal de présentation (QR en V1) vit au
 * bord client : le moteur ne le connaît pas (champ `channel` purement d'audit).
 *
 * Règles non négociables appliquées ici :
 *  - Générique, piloté par le registre (aucune logique métier).
 *  - Journal append-only pour chaque vérification (auditabilité).
 *  - Vérification atomique et idempotente.
 *  - Divulgation minimale bornée par le contrat du purpose.
 *  - Accès uniquement via cette interface publique (pas d'accès DB direct
 *    par les autres organes).
 */

const crypto = require('crypto');
const db = require('../db');
const registry = require('./identityRegistry');

const { PRESENTATION_STATUS, EVENT_TYPE } = registry;

// ── Utilitaires internes ──────────────────────────────────────────────────────

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function nowIso() {
  return new Date().toISOString();
}

function isoInSeconds(seconds) {
  return new Date(Date.now() + seconds * 1000).toISOString();
}

/**
 * Génère un handle opaque, neutre vis-à-vis du canal de présentation.
 * Préfixe `mz:id:` réservé à la présentation d'identité en ligne (Approche C).
 * Un futur mode hors-ligne signé pourra utiliser un préfixe distinct sans
 * migration de schéma.
 */
function generateHandle() {
  return `mz:id:${crypto.randomBytes(24).toString('hex')}`;
}

/**
 * Résolveurs de divulgation : seule façon de transformer un utilisateur en
 * champs exposables. Chaque champ DOIT figurer dans l'allowlist du registre.
 * On n'expose jamais email, rôle, ni identifiant technique au-delà du subjectId.
 */
const DISCLOSURE_RESOLVERS = {
  displayName: (u) => u.first_name || u.name || null,
  photoUrl: (u) => u.photo_url || null,
};

/**
 * Construit la revendication d'identité, bornée par le contrat du purpose.
 */
function buildClaim(user, purpose, verificationId) {
  const fields = registry.getDisclosureContract(purpose);
  const disclosed = {};
  for (const field of fields) {
    const resolve = DISCLOSURE_RESOLVERS[field];
    if (resolve) disclosed[field] = resolve(user);
  }
  return {
    subjectId: user.id,
    ...disclosed,
    purpose,
    verifiedAt: nowIso(),
    verificationId,
  };
}

function logEvent({
  presentationId = null,
  subjectId = null,
  verifierId = null,
  verifierRole = null,
  purpose = null,
  channel = null,
  type,
  outcome = null,
  reason = null,
  idempotencyKey = null,
}) {
  const id = db.generateId();
  db.prepare(`
    INSERT INTO identity_events
      (id, presentation_id, subject_id, verifier_id, verifier_role, purpose, channel, type, outcome, reason, idempotency_key)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, presentationId, subjectId, verifierId, verifierRole,
    purpose, channel, type, outcome, reason, idempotencyKey
  );
  return id;
}

function emitToUser(io, userId, event, payload) {
  if (!io || !userId) return;
  io.to(`user_${userId}`).emit(event, payload);
}

// ── Commandes (écritures gouvernées) ──────────────────────────────────────────

/**
 * Émet un nouveau jeton de présentation pour un citoyen, en expirant le jeton
 * actif précédent pour ce (user, purpose). Appeler à nouveau = rotation.
 * Retourne le handle à présenter (encodé en QR au bord client) et sa validité.
 */
function issuePresentation({ userId, purpose = 'identity' }, io) {
  if (!userId) throw httpError(400, 'userId requis');
  if (!registry.isKnownPurpose(purpose)) throw httpError(400, `Usage inconnu : ${purpose}`);

  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(userId);
  if (!user) throw httpError(404, 'Utilisateur introuvable');

  const def = registry.getPurpose(purpose);
  const id = db.generateId();
  const handle = generateHandle();
  const expiresAt = isoInSeconds(def.ttlSeconds);

  const created = db.transaction(() => {
    // Rotation : le jeton actif précédent devient caduc.
    db.prepare(
      "UPDATE identity_presentations SET status = ?, updated_at = datetime('now') WHERE user_id = ? AND purpose = ? AND status = ?"
    ).run(PRESENTATION_STATUS.EXPIRED, userId, purpose, PRESENTATION_STATUS.ACTIVE);

    db.prepare(`
      INSERT INTO identity_presentations (id, user_id, handle, purpose, status, expires_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, userId, handle, purpose, PRESENTATION_STATUS.ACTIVE, expiresAt);

    logEvent({ presentationId: id, subjectId: userId, purpose, type: EVENT_TYPE.ISSUED });
    return db.prepare('SELECT * FROM identity_presentations WHERE id = ?').get(id);
  })();

  void io; // pas d'émission socket à l'émission (bruit inutile)
  return {
    handle: created.handle,
    purpose: created.purpose,
    expiresAt: created.expires_at,
    ttlSeconds: def.ttlSeconds,
    rotateSeconds: def.rotateSeconds,
  };
}

/**
 * Vérifie un handle présenté et retourne une revendication d'identité vérifiée.
 * Le vérificateur doit posséder un rôle autorisé pour ce purpose.
 * Idempotent via `idempotencyKey` : rejouer le même scan renvoie la même
 * revendication sans double-effet.
 *
 * IMPORTANT : cette fonction IDENTIFIE uniquement. Elle ne consulte aucun organe
 * métier et ne prend aucune décision. L'appelant applique ensuite sa logique.
 */
function verifyPresentation(
  { handle, verifierId = null, verifierRole = null, purpose = 'identity', channel = 'qr', idempotencyKey = null },
  io
) {
  if (!handle) throw httpError(400, 'handle requis');
  if (!registry.isKnownPurpose(purpose)) throw httpError(400, `Usage inconnu : ${purpose}`);
  if (!registry.canVerify(purpose, verifierRole)) {
    throw httpError(403, "Rôle non autorisé à vérifier cette identité");
  }

  const result = db.transaction(() => {
    // Idempotence : un scan rejoué renvoie la revendication d'origine.
    if (idempotencyKey) {
      const prior = db
        .prepare("SELECT * FROM identity_events WHERE idempotency_key = ? AND type = ?")
        .get(idempotencyKey, EVENT_TYPE.VALIDATED);
      if (prior) {
        const user = db.prepare('SELECT * FROM users WHERE id = ?').get(prior.subject_id);
        if (user) return { claim: buildClaim(user, purpose, prior.id), subjectId: user.id, replayed: true };
      }
    }

    const pres = db.prepare('SELECT * FROM identity_presentations WHERE handle = ?').get(handle);
    if (!pres) {
      logEvent({ purpose, channel, verifierId, verifierRole, type: EVENT_TYPE.REJECTED, outcome: 'unknown', idempotencyKey });
      throw httpError(404, 'Identité non reconnue');
    }

    if (pres.status !== PRESENTATION_STATUS.ACTIVE) {
      logEvent({ presentationId: pres.id, subjectId: pres.user_id, purpose, channel, verifierId, verifierRole, type: EVENT_TYPE.REJECTED, outcome: pres.status, idempotencyKey });
      throw httpError(409, 'Jeton non valide (déjà utilisé, expiré ou révoqué)');
    }

    if (new Date(pres.expires_at).getTime() < Date.now()) {
      db.prepare("UPDATE identity_presentations SET status = ?, updated_at = datetime('now') WHERE id = ?")
        .run(PRESENTATION_STATUS.EXPIRED, pres.id);
      logEvent({ presentationId: pres.id, subjectId: pres.user_id, purpose, channel, verifierId, verifierRole, type: EVENT_TYPE.REJECTED, outcome: 'expired', idempotencyKey });
      throw httpError(409, 'Jeton expiré');
    }

    // Usage unique : le jeton est consommé par la vérification.
    db.prepare("UPDATE identity_presentations SET status = ?, updated_at = datetime('now') WHERE id = ?")
      .run(PRESENTATION_STATUS.USED, pres.id);

    const verificationId = logEvent({
      presentationId: pres.id,
      subjectId: pres.user_id,
      verifierId,
      verifierRole,
      purpose,
      channel,
      type: EVENT_TYPE.VALIDATED,
      outcome: 'validated',
      idempotencyKey,
    });

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(pres.user_id);
    if (!user) throw httpError(404, 'Utilisateur introuvable');
    return { claim: buildClaim(user, purpose, verificationId), subjectId: user.id, replayed: false };
  })();

  if (io && !result.replayed) {
    emitToUser(io, result.subjectId, 'identity:verified', {
      purpose,
      channel,
      verifiedAt: result.claim.verifiedAt,
    });
  }
  return result.claim;
}

/**
 * Invalide tous les jetons actifs d'un citoyen (déconnexion, incident).
 * Primitive de sécurité : garantit qu'aucune présentation en cours ne survit.
 */
function revokeAll({ userId, reason = null }, io) {
  if (!userId) throw httpError(400, 'userId requis');

  const count = db.transaction(() => {
    const actives = db
      .prepare('SELECT id FROM identity_presentations WHERE user_id = ? AND status = ?')
      .all(userId, PRESENTATION_STATUS.ACTIVE);
    db.prepare(
      "UPDATE identity_presentations SET status = ?, updated_at = datetime('now') WHERE user_id = ? AND status = ?"
    ).run(PRESENTATION_STATUS.REVOKED, userId, PRESENTATION_STATUS.ACTIVE);
    logEvent({ subjectId: userId, purpose: null, type: EVENT_TYPE.REVOKED, reason });
    return actives.length;
  })();

  if (io) emitToUser(io, userId, 'identity:revoked', { reason });
  return { revoked: count };
}

// ── Requêtes (lectures) ───────────────────────────────────────────────────────

/**
 * Jeton actif courant d'un citoyen (null si aucun ou expiré).
 */
function getActivePresentation(userId, purpose = 'identity') {
  const pres = db
    .prepare('SELECT * FROM identity_presentations WHERE user_id = ? AND purpose = ? AND status = ? ORDER BY created_at DESC LIMIT 1')
    .get(userId, purpose, PRESENTATION_STATUS.ACTIVE);
  if (!pres) return null;
  if (new Date(pres.expires_at).getTime() < Date.now()) return null;
  return {
    handle: pres.handle,
    purpose: pres.purpose,
    expiresAt: pres.expires_at,
  };
}

/**
 * Historique des identifications réussies d'un citoyen (transparence).
 */
function getVerificationHistory(userId, filters = {}) {
  let sql = "SELECT * FROM identity_events WHERE subject_id = ? AND type = ?";
  const args = [userId, EVENT_TYPE.VALIDATED];
  if (filters.purpose) {
    sql += ' AND purpose = ?';
    args.push(filters.purpose);
  }
  sql += ' ORDER BY created_at DESC LIMIT 100';
  return db.prepare(sql).all(...args).map((e) => ({
    id: e.id,
    purpose: e.purpose,
    channel: e.channel,
    verifierRole: e.verifier_role,
    verifiedAt: e.created_at,
  }));
}

module.exports = {
  // Commandes
  issuePresentation,
  verifyPresentation,
  revokeAll,
  // Requêtes
  getActivePresentation,
  getVerificationHistory,
  // Métadonnées du registre (lecture)
  listPurposes: registry.listPurposes,
  getPurpose: registry.getPurpose,
};
