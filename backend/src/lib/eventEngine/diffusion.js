/**
 * Event Engine — Couche de diffusion (Mode Réception + Opportunités Volantes).
 *
 * Distinction fondamentale du brief :
 *   Une Opportunité Volante N'EST PAS un type d'événement.
 *   C'est une STRATÉGIE DE DIFFUSION d'une initiative existante.
 *
 * Deux régimes :
 *  - Diffusion passive : l'initiative est *découvrable* via les requêtes des
 *    portes (gérée par le cœur `listEvents`). Rien à faire ici.
 *  - Diffusion active (Opportunité Volante) : on PORTE spontanément l'initiative
 *    aux habitants abonnés au bon canal, au bon moment. C'est le rôle de ce module.
 *
 * Ce module ne connaît pas le cœur (`index.js`) : il reçoit l'initiative déjà
 * projetée. Pas de cycle d'import. Il orchestre : abonnements + signal temps réel.
 */

const db = require('../../db');
const registry = require('./eventRegistry');
const bus = require('./bus');

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

// ── Mode Réception (abonnements de l'habitant) ────────────────────────────────

/** Canaux d'écoute de l'habitant (+ rayon géo éventuel). */
function getSubscriptions(userId) {
  return db
    .prepare('SELECT channel, radius_km, zone_id FROM event_subscriptions WHERE user_id = ? ORDER BY channel')
    .all(userId)
    .map((r) => ({ channel: r.channel, radiusKm: r.radius_km, zoneId: r.zone_id }));
}

/**
 * Définit le Mode Réception : remplace l'ensemble des abonnements de l'habitant.
 * `entries` = [{ channel, radiusKm?, zoneId? }]. Tous les canaux sont validés.
 */
function setSubscriptions(userId, entries = []) {
  for (const e of entries) {
    if (!registry.isKnownChannel(e.channel)) throw httpError(400, `Canal inconnu : ${e.channel}`);
  }
  return db.transaction(() => {
    db.prepare('DELETE FROM event_subscriptions WHERE user_id = ?').run(userId);
    for (const e of entries) {
      db.prepare(
        'INSERT INTO event_subscriptions (id, user_id, channel, radius_km, zone_id) VALUES (?, ?, ?, ?, ?)'
      ).run(db.generateId(), userId, e.channel, e.radiusKm ?? null, e.zoneId ?? null);
    }
    return getSubscriptions(userId);
  })();
}

/**
 * Habitants abonnés à AU MOINS un des canaux fournis. Le filtre géographique
 * (rayon / zone) est un raffinement ultérieur ; on borne ici sur zoneId si fourni.
 */
function matchSubscribers(channels = [], { zoneId = null } = {}) {
  if (!channels.length) return [];
  const ph = channels.map(() => '?').join(',');
  let sql = `SELECT DISTINCT user_id FROM event_subscriptions WHERE channel IN (${ph})`;
  const args = [...channels];
  if (zoneId) {
    sql += ' AND (zone_id IS NULL OR zone_id = ?)';
    args.push(zoneId);
  }
  return db.prepare(sql).all(...args).map((r) => r.user_id);
}

// ── Opportunité Volante (diffusion active) ────────────────────────────────────

/**
 * Exécute une Opportunité Volante pour une initiative déjà publiée.
 *
 * @param event   Initiative projetée (doit être publiée et de type `isFlyable`).
 * @param policy  { channels?, windowStart?, windowEnd?, note? } — la stratégie.
 * @param io      Socket.io (signal temps réel vers les habitants ciblés).
 * @param opts    { idempotencyKey? } — évite de rejouer un même envoi.
 *
 * Retourne un résumé { diffusions, reached }. N'implémente aucune règle métier
 * d'un autre organe : il porte l'initiative, il ne la transforme pas.
 */
function runOpportunity(event, policy = {}, io, { idempotencyKey = null } = {}) {
  if (!event) throw httpError(404, 'Initiative introuvable');
  if (!registry.hasCapability(event.type, 'isFlyable')) {
    throw httpError(409, `Le type "${event.type}" n'est pas éligible à une Opportunité Volante`);
  }
  if (event.status !== 'published' && event.status !== 'live') {
    throw httpError(409, 'Seule une initiative publiée peut être diffusée');
  }

  // Idempotence : un même envoi (clé fournie) n'est jamais rejoué.
  if (idempotencyKey) {
    const prior = db.prepare('SELECT id FROM event_diffusions WHERE idempotency_key = ?').get(idempotencyKey);
    if (prior) {
      return { replayed: true, diffusions: 0, reached: 0 };
    }
  }

  // Canaux ciblés : ceux de la politique, sinon les canaux de l'initiative.
  const channels = (policy.channels && policy.channels.length ? policy.channels : event.channels) || [];
  for (const ch of channels) {
    if (!registry.isKnownChannel(ch)) throw httpError(400, `Canal inconnu : ${ch}`);
  }
  if (!channels.length) throw httpError(400, 'Aucun canal de diffusion cible');

  const subscribers = matchSubscribers(channels, { zoneId: event.zoneId });

  const summary = db.transaction(() => {
    let diffusions = 0;
    for (const ch of channels) {
      db.prepare(`
        INSERT INTO event_diffusions
          (id, event_id, channel, policy, window_start, window_end, status, reached, idempotency_key)
        VALUES (?, ?, ?, ?, ?, ?, 'sent', ?, ?)
      `).run(
        db.generateId(), event.id, ch,
        policy.note ? JSON.stringify({ note: policy.note }) : null,
        policy.windowStart || null, policy.windowEnd || null,
        subscribers.length,
        // La clé d'idempotence porte sur l'envoi global ; on la range sur le 1er canal.
        diffusions === 0 ? idempotencyKey : null
      );
      diffusions += 1;
    }
    return { diffusions, reached: subscribers.length };
  })();

  // Signal temps réel : porter l'initiative vers chaque habitant ciblé.
  if (io) {
    for (const uid of subscribers) {
      io.to(`user_${uid}`).emit('event:opportunity', { event, channels });
    }
  }

  // Fait de domaine interne (stats / notifications / IA).
  bus.emit(bus.DOMAIN_EVENT.DIFFUSED, { event, channels, reached: subscribers.length });

  return { replayed: false, ...summary };
}

/** Historique des diffusions d'une initiative (transparence / stats). */
function getDiffusions(eventId) {
  return db
    .prepare('SELECT id, channel, policy, window_start, window_end, status, reached, created_at FROM event_diffusions WHERE event_id = ? ORDER BY created_at DESC')
    .all(eventId)
    .map((d) => ({
      id: d.id,
      channel: d.channel,
      policy: d.policy ? JSON.parse(d.policy) : null,
      windowStart: d.window_start,
      windowEnd: d.window_end,
      status: d.status,
      reached: d.reached,
      createdAt: d.created_at,
    }));
}

module.exports = {
  getSubscriptions,
  setSubscriptions,
  matchSubscribers,
  runOpportunity,
  getDiffusions,
};
