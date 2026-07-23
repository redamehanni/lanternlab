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
 *    aux habitants abonnés au bon canal, dans un périmètre, jusqu'à un quota.
 *
 * Ce module ne connaît pas le cœur (`index.js`) : il reçoit l'initiative déjà
 * projetée. Pas de cycle d'import. Il orchestre : abonnements + géographie +
 * boîte aux lettres + signal temps réel.
 *
 * Extensibilité volontaire (NE PAS coder maintenant, mais ne PAS bloquer) :
 *  - Rareté (Commun → Mythique) : propriété future via `meta.rarity` / payload.
 *  - Ticket d'Or : mécanique événementielle distincte via `policy.campaignKind`
 *    (ex. 'golden_ticket'), jamais confondue avec un niveau de rareté.
 */

const db = require('../../db');
const registry = require('./eventRegistry');
const bus = require('./bus');
const { distanceKm } = require('../geo');

const INBOX_STATUS = {
  RECEIVED: 'received',
  ACCEPTED: 'accepted',
  DISMISSED: 'dismissed',
};

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
 * Habitants abonnés à AU MOINS un des canaux fournis, enrichis de leur position
 * et de la distance à l'épicentre de l'initiative.
 *
 * Filtre spatial :
 *  - si `radiusKm` (campagne) est fourni → distance ≤ radiusKm ;
 *  - sinon, si l'abonnement a un `radius_km` → distance ≤ ce rayon ;
 *  - les habitants sans coordonnées sont exclus dès qu'un filtre spatial s'applique ;
 *  - `zoneId` reste un raffinement optionnel (compatibilité).
 *
 * @returns [{ userId, lat, lng, distanceKm }]
 */
function matchSubscribers(channels = [], { zoneId = null, originLat = null, originLng = null, radiusKm = null } = {}) {
  if (!channels.length) return [];
  const ph = channels.map(() => '?').join(',');
  let sql = `
    SELECT DISTINCT s.user_id AS user_id, u.lat AS lat, u.lng AS lng, s.radius_km AS sub_radius
    FROM event_subscriptions s
    JOIN users u ON u.id = s.user_id
    WHERE s.channel IN (${ph})
  `;
  const args = [...channels];
  if (zoneId) {
    sql += ' AND (s.zone_id IS NULL OR s.zone_id = ?)';
    args.push(zoneId);
  }
  const rows = db.prepare(sql).all(...args);

  const spatial = originLat != null && originLng != null;
  const campaignRadius = radiusKm != null && Number.isFinite(Number(radiusKm))
    ? Number(radiusKm)
    : null;

  const matched = [];
  for (const r of rows) {
    let dist = null;
    if (spatial && r.lat != null && r.lng != null) {
      dist = distanceKm(originLat, originLng, r.lat, r.lng);
    }

    // Périmètre campagne (prioritaire) ou rayon d'écoute individuel.
    const limit = campaignRadius != null
      ? campaignRadius
      : (r.sub_radius != null ? Number(r.sub_radius) : null);

    if (limit != null) {
      if (dist == null || dist > limit) continue;
    }

    matched.push({
      userId: r.user_id,
      lat: r.lat,
      lng: r.lng,
      distanceKm: dist != null ? Math.round(dist * 100) / 100 : null,
    });
  }

  // Plus proches d'abord : sélection naturelle avant application du quota.
  matched.sort((a, b) => {
    if (a.distanceKm == null && b.distanceKm == null) return 0;
    if (a.distanceKm == null) return 1;
    if (b.distanceKm == null) return -1;
    return a.distanceKm - b.distanceKm;
  });

  return matched;
}

/**
 * Résout l'épicentre géo d'une initiative : ses propres coords, sinon celles
 * de sa boutique. Sans position, la diffusion reste canal-only (rétrocompat).
 */
function resolveOrigin(event) {
  if (event.lat != null && event.lng != null) {
    return { lat: event.lat, lng: event.lng };
  }
  if (event.storeId) {
    const store = db.prepare('SELECT lat, lng FROM stores WHERE id = ?').get(event.storeId);
    if (store && store.lat != null && store.lng != null) {
      return { lat: store.lat, lng: store.lng };
    }
  }
  return { lat: null, lng: null };
}

// ── Opportunité Volante (diffusion active) ────────────────────────────────────

/**
 * Exécute une Opportunité Volante pour une initiative déjà publiée.
 *
 * @param event   Initiative projetée (doit être publiée et de type `isFlyable`).
 * @param policy  {
 *   channels?, windowStart?, windowEnd?, note?,
 *   radiusKm?,   // périmètre de diffusion (km)
 *   quota?,      // nombre max d'habitants à atteindre
 *   actor?,
 *   // Réserve d'extensibilité (non utilisée aujourd'hui) :
 *   // campaignKind?: 'standard' | 'golden_ticket' | …
 *   // rarity?: string  — rareté propre à l'opportunité (futur)
 * }
 * @param io      Socket.io (signal temps réel vers les habitants ciblés).
 * @param opts    { idempotencyKey? } — évite de rejouer un même envoi.
 *
 * Retourne { diffusions, reached, inboxIds, candidates }.
 */
function runOpportunity(event, policy = {}, io, { idempotencyKey = null } = {}) {
  if (!event) throw httpError(404, 'Initiative introuvable');
  if (!registry.hasCapability(event.type, 'isFlyable')) {
    throw httpError(409, `Le type "${event.type}" n'est pas éligible à une Opportunité Volante`);
  }
  if (event.status !== 'published' && event.status !== 'live') {
    throw httpError(409, 'Seule une initiative publiée peut être diffusée');
  }

  if (idempotencyKey) {
    const prior = db.prepare('SELECT id FROM event_diffusions WHERE idempotency_key = ?').get(idempotencyKey);
    if (prior) {
      return { replayed: true, diffusions: 0, reached: 0, inboxIds: [] };
    }
  }

  const channels = (policy.channels && policy.channels.length ? policy.channels : event.channels) || [];
  for (const ch of channels) {
    if (!registry.isKnownChannel(ch)) throw httpError(400, `Canal inconnu : ${ch}`);
  }
  if (!channels.length) throw httpError(400, 'Aucun canal de diffusion cible');

  const radiusKm = policy.radiusKm != null && policy.radiusKm !== ''
    ? Number(policy.radiusKm)
    : null;
  if (radiusKm != null && (!Number.isFinite(radiusKm) || radiusKm <= 0)) {
    throw httpError(400, 'radiusKm doit être un nombre positif');
  }

  const quota = policy.quota != null && policy.quota !== ''
    ? Math.floor(Number(policy.quota))
    : null;
  if (quota != null && (!Number.isFinite(quota) || quota < 1)) {
    throw httpError(400, 'quota doit être un entier ≥ 1');
  }

  const origin = resolveOrigin(event);
  let candidates = matchSubscribers(channels, {
    zoneId: event.zoneId,
    originLat: origin.lat,
    originLng: origin.lng,
    radiusKm,
  });

  if (quota != null) candidates = candidates.slice(0, quota);

  // Politique persistée en JSON (opaque) — extensible (rareté, Ticket d'Or…).
  const policySnapshot = {
    note: policy.note || null,
    radiusKm: radiusKm,
    quota: quota,
    channels,
    // Placeholders documentés, non renseignés aujourd'hui :
    // campaignKind: policy.campaignKind || 'standard',
    // rarity: policy.rarity || null,
  };

  const result = db.transaction(() => {
    const diffusionIds = [];
    let firstDiffusionId = null;
    for (let i = 0; i < channels.length; i++) {
      const ch = channels[i];
      const id = db.generateId();
      db.prepare(`
        INSERT INTO event_diffusions
          (id, event_id, channel, policy, window_start, window_end, status, reached, idempotency_key)
        VALUES (?, ?, ?, ?, ?, ?, 'sent', ?, ?)
      `).run(
        id, event.id, ch,
        JSON.stringify(policySnapshot),
        policy.windowStart || null, policy.windowEnd || null,
        candidates.length,
        i === 0 ? idempotencyKey : null
      );
      diffusionIds.push(id);
      if (i === 0) firstDiffusionId = id;
    }

    const inboxIds = [];
    const insertInbox = db.prepare(`
      INSERT OR IGNORE INTO event_opportunity_inbox
        (id, user_id, event_id, diffusion_id, channels, distance_km, status, meta)
      VALUES (?, ?, ?, ?, ?, ?, 'received', ?)
    `);
    for (const c of candidates) {
      const inboxId = db.generateId();
      // meta opaque : réserve pour rareté / Ticket d'Or / annotations futures.
      const meta = {
        // rarity: null,
        // campaignKind: policy.campaignKind || 'standard',
      };
      const info = insertInbox.run(
        inboxId, c.userId, event.id, firstDiffusionId,
        JSON.stringify(channels),
        c.distanceKm,
        JSON.stringify(meta)
      );
      if (info.changes > 0) inboxIds.push({ id: inboxId, userId: c.userId, distanceKm: c.distanceKm });
    }

    return { diffusions: diffusionIds.length, reached: candidates.length, inboxIds, diffusionId: firstDiffusionId };
  })();

  if (io) {
    for (const entry of result.inboxIds) {
      io.to(`user_${entry.userId}`).emit('event:opportunity', {
        event,
        channels,
        inboxId: entry.id,
        distanceKm: entry.distanceKm,
      });
    }
  }

  bus.emit(bus.DOMAIN_EVENT.DIFFUSED, {
    event,
    channels,
    reached: result.reached,
    radiusKm,
    quota,
  });

  return { replayed: false, ...result };
}

/** Historique des diffusions d'une initiative (transparence / stats). */
function getDiffusions(eventId) {
  return db
    .prepare('SELECT id, channel, policy, window_start, window_end, status, reached, created_at FROM event_diffusions WHERE event_id = ? ORDER BY created_at DESC')
    .all(eventId)
    .map((d) => ({
      id: d.id,
      channel: d.channel,
      policy: safeParse(d.policy),
      windowStart: d.window_start,
      windowEnd: d.window_end,
      status: d.status,
      reached: d.reached,
      createdAt: d.created_at,
    }));
}

// ── Boîte aux lettres (reçus par habitant) ────────────────────────────────────

/**
 * Liste les opportunités reçues par un habitant.
 * Tris supportés : date | distance | channel | seats
 * (channel = premier canal ; seats = places restantes si billetterie).
 */
function listInbox(userId, { sort = 'date', status = null } = {}) {
  let sql = `
    SELECT i.*, e.title, e.summary, e.type, e.status AS event_status, e.starts_at,
           e.address, e.lat, e.lng, e.capacity, e.channels AS event_channels,
           e.payload AS event_payload, e.store_id
    FROM event_opportunity_inbox i
    JOIN events e ON e.id = i.event_id
    WHERE i.user_id = ?
  `;
  const args = [userId];
  if (status) {
    sql += ' AND i.status = ?';
    args.push(status);
  }
  sql += ' ORDER BY i.created_at DESC';
  const rows = db.prepare(sql).all(...args);

  const ticketsIssuedStmt = db.prepare(
    "SELECT COUNT(*) c FROM event_journal WHERE event_id = ? AND type = 'ticket_issued'"
  );

  let items = rows.map((r) => {
    const def = registry.getType(r.type);
    const payload = safeParse(r.event_payload) || {};
    const reservation = payload.reservation || null;
    const issued = def?.capabilities?.canTicket ? ticketsIssuedStmt.get(r.event_id).c : 0;
    const seatsLeft = r.capacity != null ? Math.max(0, r.capacity - issued) : null;
    const channels = safeParse(r.channels) || safeParse(r.event_channels) || [];
    return {
      id: r.id,
      status: r.status,
      distanceKm: r.distance_km,
      channels,
      meta: safeParse(r.meta) || {},
      ticketObjectId: r.ticket_object_id,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      event: {
        id: r.event_id,
        type: r.type,
        label: def?.label || r.type,
        title: r.title,
        summary: r.summary,
        status: r.event_status,
        startsAt: r.starts_at,
        address: r.address,
        lat: r.lat,
        lng: r.lng,
        capacity: r.capacity,
        channels: safeParse(r.event_channels) || [],
        capabilities: def?.capabilities || {},
        reservation: reservation
          ? {
              required: reservation.mode === 'ticket',
              price: Number(reservation.price) || 0,
              currency: reservation.currency || 'EUR',
              seatsLeft,
              soldOut: seatsLeft === 0,
            }
          : (def?.capabilities?.canTicket
            ? { required: false, price: 0, currency: 'EUR', seatsLeft, soldOut: false }
            : null),
      },
    };
  });

  if (sort === 'distance') {
    items.sort((a, b) => {
      if (a.distanceKm == null && b.distanceKm == null) return 0;
      if (a.distanceKm == null) return 1;
      if (b.distanceKm == null) return -1;
      return a.distanceKm - b.distanceKm;
    });
  } else if (sort === 'channel' || sort === 'interest') {
    items.sort((a, b) => String(a.channels[0] || '').localeCompare(String(b.channels[0] || '')));
  } else if (sort === 'seats') {
    items.sort((a, b) => {
      const sa = a.event.reservation?.seatsLeft;
      const sb = b.event.reservation?.seatsLeft;
      if (sa == null && sb == null) return 0;
      if (sa == null) return 1;
      if (sb == null) return -1;
      return sa - sb;
    });
  }
  // sort === 'date' : déjà ORDER BY created_at DESC

  return items;
}

function getInboxItem(inboxId, userId = null) {
  const row = db.prepare('SELECT * FROM event_opportunity_inbox WHERE id = ?').get(inboxId);
  if (!row) throw httpError(404, 'Opportunité introuvable dans la boîte aux lettres');
  if (userId && row.user_id !== userId) throw httpError(403, 'Accès refusé');
  return row;
}

/**
 * Marque un reçu comme accepté et attache l'éventuel objet Wallet émis.
 * L'émission du ticket est orchestrée par l'appelant (index.js) — ce module
 * ne touche jamais au Wallet directement.
 */
function markInboxAccepted(inboxId, userId, { ticketObjectId = null } = {}) {
  const row = getInboxItem(inboxId, userId);
  if (row.status === INBOX_STATUS.ACCEPTED) {
    return { replayed: true, row };
  }
  db.prepare(`
    UPDATE event_opportunity_inbox
    SET status = 'accepted', ticket_object_id = COALESCE(?, ticket_object_id),
        updated_at = datetime('now')
    WHERE id = ?
  `).run(ticketObjectId, inboxId);
  return { replayed: false, row: getInboxItem(inboxId, userId) };
}

function markInboxDismissed(inboxId, userId) {
  getInboxItem(inboxId, userId);
  db.prepare(`
    UPDATE event_opportunity_inbox
    SET status = 'dismissed', updated_at = datetime('now')
    WHERE id = ?
  `).run(inboxId);
  return getInboxItem(inboxId, userId);
}

function countInbox(userId, { status = INBOX_STATUS.RECEIVED } = {}) {
  return db
    .prepare('SELECT COUNT(*) c FROM event_opportunity_inbox WHERE user_id = ? AND status = ?')
    .get(userId, status).c;
}

module.exports = {
  getSubscriptions,
  setSubscriptions,
  matchSubscribers,
  runOpportunity,
  getDiffusions,
  listInbox,
  getInboxItem,
  markInboxAccepted,
  markInboxDismissed,
  countInbox,
  resolveOrigin,
  INBOX_STATUS,
};
