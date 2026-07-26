/**
 * Event Engine — Le cœur vivant de Ma Zone.
 *
 * Organe dédié aux INITIATIVES LOCALES et à leur cycle de vie (du brouillon à
 * l'archivage). Il aide la ville à produire davantage de vie locale ; il n'est
 * pas le miroir de la ville, ni un agenda, ni un catalogue de l'existant.
 *
 * Règles non négociables (mêmes principes que Wallet / Identity) :
 *  - Générique, piloté par le registre (aucun `if (type === ...)` métier).
 *  - Journal append-only pour chaque transition (audit + biographie).
 *  - Payload opaque + descripteur d'affichage séparé.
 *  - ORCHESTRE les autres organes (Wallet, Identity, Communication) — il ne
 *    réimplémente jamais leur logique et n'absorbe pas leurs responsabilités.
 *  - Accès uniquement via cette interface publique (pas d'accès DB direct par
 *    les autres organes).
 *  - N'est PAS un Event Bus technique universel : voir bus.js.
 */

const db = require('../../db');
const registry = require('./eventRegistry');
const lifecycle = require('./lifecycle');
const bus = require('./bus');
const diffusion = require('./diffusion');
const orchestration = require('./orchestration');
const wallet = require('../walletEngine');

// Auto-déclaration des types (Open/Closed).
require('./types');

// Branche les abonnés du hook interne (stats / notifications / IA), une fois.
const subscribers = require('./subscribers');
subscribers.registerAll();

const { EVENT_STATUS } = lifecycle;
const { JOURNAL_EVENT_TYPE } = registry;

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

function getRawEvent(eventId) {
  return db.prepare('SELECT * FROM events WHERE id = ?').get(eventId);
}

/**
 * Projette une ligne brute en initiative enrichie (display via le type,
 * capacités déclarées). Le payload reste opaque : seul le type le lit.
 */
function rowToEvent(row) {
  if (!row) return null;
  const def = registry.getType(row.type);
  return {
    id: row.id,
    type: row.type,
    label: def?.label || row.type,
    status: row.status,
    sourceKind: row.source_kind,
    sourceId: row.source_id,
    title: row.title,
    summary: row.summary,
    body: row.body,
    media: safeParse(row.media),
    display: registry.project(row.type, row),
    payload: safeParse(row.payload),
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    timezone: row.timezone,
    lat: row.lat,
    lng: row.lng,
    zoneId: row.zone_id,
    address: row.address,
    geoPrecision: row.geo_precision,
    visibility: row.visibility,
    capacity: row.capacity,
    channels: safeParse(row.channels) || [],
    storeId: row.store_id,
    productId: row.product_id,
    parentEventId: row.parent_event_id,
    sourceRef: row.source_ref,
    capabilities: def?.capabilities || {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Émission socket sûre (l'infra temps réel reste optionnelle). */
function emitSocket(io, event, payload) {
  if (!io) return;
  io.emit(event, payload);
}

function journal(eventId, { type, fromStatus = null, toStatus = null, actor = null, payload = null, idempotencyKey = null }) {
  db.prepare(`
    INSERT INTO event_journal
      (id, event_id, type, from_status, to_status, actor, payload, idempotency_key)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    db.generateId(),
    eventId,
    type,
    fromStatus,
    toStatus,
    actor,
    payload ? JSON.stringify(payload) : null,
    idempotencyKey
  );
}

// ── Commandes (écritures gouvernées) ──────────────────────────────────────────

/**
 * Crée une initiative locale. Elle naît en brouillon (ou au statut initial du
 * type). Valide le type, la source, le payload requis et les canaux déclarés.
 */
function createEvent(params, io) {
  const {
    type,
    sourceKind,
    sourceId = null,
    title,
    summary = null,
    body = null,
    media = null,
    display = null,
    payload = null,
    startsAt = null,
    endsAt = null,
    timezone = null,
    lat = null,
    lng = null,
    zoneId = null,
    address = null,
    geoPrecision = null,
    visibility = registry.VISIBILITY.PUBLIC,
    capacity = null,
    channels = null,
    storeId = null,
    productId = null,
    parentEventId = null,
    sourceRef = null,
  } = params || {};

  if (!type || !registry.isKnownType(type)) throw httpError(400, `Type d'événement inconnu : ${type}`);
  if (!sourceKind || !registry.isKnownSourceKind(sourceKind)) throw httpError(400, `Source inconnue : ${sourceKind}`);
  if (!title) throw httpError(400, 'title requis');

  const def = registry.getType(type);

  // Validation minimale du payload (clés requises déclarées par le type).
  for (const key of def.requiredPayload) {
    if (!payload || payload[key] === undefined || payload[key] === null) {
      throw httpError(400, `Champ requis manquant dans le payload : ${key}`);
    }
  }

  // Canaux : ceux fournis, sinon les canaux par défaut du type. Tous validés.
  const finalChannels = (channels && channels.length ? channels : def.defaultChannels) || [];
  for (const ch of finalChannels) {
    if (!registry.isKnownChannel(ch)) throw httpError(400, `Canal de diffusion inconnu : ${ch}`);
  }

  const id = db.generateId();
  const status = lifecycle.getInitialStatus(def);

  const created = db.transaction(() => {
    db.prepare(`
      INSERT INTO events
        (id, type, status, source_kind, source_id, title, summary, body, media, display, payload,
         starts_at, ends_at, timezone, lat, lng, zone_id, address, geo_precision,
         visibility, capacity, channels, store_id, product_id, parent_event_id, source_ref)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, type, status, sourceKind, sourceId, title, summary, body,
      media ? JSON.stringify(media) : null,
      display ? JSON.stringify(display) : null,
      payload ? JSON.stringify(payload) : null,
      startsAt, endsAt, timezone, lat, lng, zoneId, address, geoPrecision,
      visibility, capacity,
      JSON.stringify(finalChannels),
      storeId, productId, parentEventId, sourceRef
    );
    journal(id, { type: JOURNAL_EVENT_TYPE.CREATED, toStatus: status, actor: sourceKind });
    return getRawEvent(id);
  })();

  bus.emit(bus.DOMAIN_EVENT.CREATED, { event: rowToEvent(created) });
  return rowToEvent(created);
}

/**
 * Met à jour une initiative (édition, essentiellement en brouillon/planification).
 * Champs contenu / temps / lieu / diffusion. Ne change jamais le statut.
 */
function updateEvent(eventId, patch = {}, io) {
  const row = getRawEvent(eventId);
  if (!row) throw httpError(404, 'Initiative introuvable');

  const EDITABLE = {
    title: 'title', summary: 'summary', body: 'body',
    startsAt: 'starts_at', endsAt: 'ends_at', timezone: 'timezone',
    lat: 'lat', lng: 'lng', zoneId: 'zone_id', address: 'address', geoPrecision: 'geo_precision',
    visibility: 'visibility', capacity: 'capacity',
  };
  const JSON_FIELDS = { media: 'media', display: 'display', payload: 'payload' };

  const sets = [];
  const args = [];
  for (const [key, col] of Object.entries(EDITABLE)) {
    if (patch[key] !== undefined) { sets.push(`${col} = ?`); args.push(patch[key]); }
  }
  for (const [key, col] of Object.entries(JSON_FIELDS)) {
    if (patch[key] !== undefined) { sets.push(`${col} = ?`); args.push(patch[key] ? JSON.stringify(patch[key]) : null); }
  }
  if (patch.channels !== undefined) {
    for (const ch of patch.channels || []) {
      if (!registry.isKnownChannel(ch)) throw httpError(400, `Canal de diffusion inconnu : ${ch}`);
    }
    sets.push('channels = ?'); args.push(JSON.stringify(patch.channels || []));
  }
  if (sets.length === 0) return rowToEvent(row);

  const updated = db.transaction(() => {
    db.prepare(`UPDATE events SET ${sets.join(', ')}, updated_at = datetime('now') WHERE id = ?`).run(...args, eventId);
    journal(eventId, { type: JOURNAL_EVENT_TYPE.UPDATED, fromStatus: row.status, toStatus: row.status });
    return getRawEvent(eventId);
  })();

  bus.emit(bus.DOMAIN_EVENT.UPDATED, { event: rowToEvent(updated) });
  return rowToEvent(updated);
}

/**
 * Applique une transition de cycle de vie (fail-fast via le registre du type).
 * Écrit au journal et émet le fait de domaine + le signal temps réel adéquat.
 */
function transitionEvent(eventId, toStatus, { actor = null, payload = null } = {}, io) {
  const updated = db.transaction(() => {
    const row = getRawEvent(eventId);
    if (!row) throw httpError(404, 'Initiative introuvable');
    const def = registry.getType(row.type);
    if (!lifecycle.canTransition(def, row.status, toStatus)) {
      throw httpError(409, `Transition non autorisée : ${row.status} → ${toStatus}`);
    }
    db.prepare("UPDATE events SET status = ?, updated_at = datetime('now') WHERE id = ?").run(toStatus, eventId);
    const isPublish = toStatus === EVENT_STATUS.PUBLISHED;
    const isCancel = toStatus === EVENT_STATUS.CANCELLED;
    journal(eventId, {
      type: isPublish ? JOURNAL_EVENT_TYPE.PUBLISHED : isCancel ? JOURNAL_EVENT_TYPE.CANCELLED : JOURNAL_EVENT_TYPE.TRANSITIONED,
      fromStatus: row.status,
      toStatus,
      actor,
      payload,
    });
    return { row: getRawEvent(eventId), fromStatus: row.status };
  })();

  const event = rowToEvent(updated.row);

  // Fait de domaine interne (notifications / stats / IA).
  const domainByStatus = {
    [EVENT_STATUS.PUBLISHED]: bus.DOMAIN_EVENT.PUBLISHED,
    [EVENT_STATUS.CANCELLED]: bus.DOMAIN_EVENT.CANCELLED,
  };
  bus.emit(domainByStatus[toStatus] || bus.DOMAIN_EVENT.TRANSITIONED, { event, fromStatus: updated.fromStatus });

  // Signal temps réel (réutilise l'infra Socket.io en place).
  const socketByStatus = {
    [EVENT_STATUS.PUBLISHED]: 'event:published',
    [EVENT_STATUS.LIVE]: 'event:live',
    [EVENT_STATUS.CANCELLED]: 'event:cancelled',
  };
  emitSocket(io, socketByStatus[toStatus] || 'event:updated', { event });

  return event;
}

/** Raccourci : publier une initiative (brouillon/planification → publiée). */
function publishEvent(eventId, opts = {}, io) {
  return transitionEvent(eventId, EVENT_STATUS.PUBLISHED, opts, io);
}

/** Raccourci : annuler une initiative. */
function cancelEvent(eventId, opts = {}, io) {
  return transitionEvent(eventId, EVENT_STATUS.CANCELLED, opts, io);
}

// ── Diffusion (Mode Réception + Opportunités Volantes) ────────────────────────

/** Mode Réception d'un habitant : ses canaux d'écoute (+ rayon géo). */
function getModeReception(userId) {
  return diffusion.getSubscriptions(userId);
}

/** Définit le Mode Réception d'un habitant (remplace ses abonnements). */
function setModeReception(userId, entries) {
  return diffusion.setSubscriptions(userId, entries);
}

/**
 * Lance une Opportunité Volante : porte activement une initiative publiée vers
 * les habitants abonnés. Trace la diffusion au journal de l'initiative.
 */
function diffuseEvent(eventId, policy = {}, io, opts = {}) {
  const event = getEventById(eventId);
  const result = diffusion.runOpportunity(event, policy, io, opts);
  if (!result.replayed) {
    journal(eventId, {
      type: JOURNAL_EVENT_TYPE.DIFFUSED,
      fromStatus: event.status,
      toStatus: event.status,
      actor: policy.actor || null,
      payload: {
        channels: policy.channels || event.channels,
        reached: result.reached,
        radiusKm: policy.radiusKm ?? null,
        quota: policy.quota ?? null,
      },
      idempotencyKey: opts.idempotencyKey || null,
    });
  }
  return result;
}

/** Historique des diffusions d'une initiative. */
function getEventDiffusions(eventId) {
  getEventById(eventId); // 404 si inconnue
  return diffusion.getDiffusions(eventId);
}

/** Boîte aux lettres de l'habitant : opportunités reçues (triables). */
function listOpportunityInbox(userId, opts = {}) {
  return diffusion.listInbox(userId, opts);
}

function countOpportunityInbox(userId, opts = {}) {
  return diffusion.countInbox(userId, opts);
}

/**
 * Trace l'émission d'un billet dans la biographie de l'initiative.
 *
 * Extrait d'`acceptOpportunity` à l'étape 5 pour que l'adaptateur d'orchestration
 * puisse l'appeler sans réécrire cette trace ailleurs. Le journal d'une initiative
 * appartient à l'Event Engine, et il n'y a qu'une façon d'y écrire.
 */
function journalTicketIssued(event, ownerId, objectId, io) {
  journal(event.id, {
    type: JOURNAL_EVENT_TYPE.TICKET_ISSUED,
    fromStatus: event.status,
    toStatus: event.status,
    actor: ownerId,
    payload: { objectId, source: 'opportunity_accept' },
  });
  bus.emit(bus.DOMAIN_EVENT.TICKET_ISSUED, { event, ownerId, objectId });
}

/**
 * Accepte une opportunité de la boîte aux lettres.
 *
 * Depuis l'étape 5, la séquence est l'intention `event.claim_opportunity` : émission
 * de l'objet Wallet puis acceptation actée, avec révocation du billet si la seconde
 * échoue. Avant, un échec après émission laissait un billet orphelin.
 *
 * Le rejeu est tranché ICI et non dans le plan : « déjà accepté » n'est pas une étape
 * qui échoue, c'est une question à laquelle la boîte aux lettres répond seule.
 */
function acceptOpportunity(inboxId, userId, io) {
  const row = diffusion.getInboxItem(inboxId, userId);
  if (row.status === diffusion.INBOX_STATUS.ACCEPTED) {
    return {
      replayed: true,
      inbox: diffusion.listInbox(userId).find((i) => i.id === inboxId) || null,
      ticket: row.ticket_object_id ? { id: row.ticket_object_id } : null,
    };
  }

  const run = require('../orchestration').run(
    'event.claim_opportunity',
    { inboxId, ownerId: userId },
    { actor: userId, actorRole: 'client', io }
  );

  const objectId = run.results['wallet.claimOpportunity'].objectId;
  const inbox = diffusion.listInbox(userId).find((i) => i.id === inboxId) || null;
  return { replayed: false, inbox, ticket: wallet.getObjectById(objectId) };
}

function dismissOpportunity(inboxId, userId) {
  diffusion.markInboxDismissed(inboxId, userId);
  return { ok: true };
}

// ── Orchestration des organes (Wallet, Identity) ──────────────────────────────

/**
 * Émet un billet (objet Wallet) pour une initiative billetterie. C'est le Wallet
 * qui gouverne le billet ; l'Event Engine ne fait qu'orchestrer et journaliser.
 */
function issueTicket(eventId, ownerId, io) {
  const event = getEventById(eventId);
  const { object } = orchestration.issueTicket(event, ownerId, io);
  journal(eventId, {
    type: JOURNAL_EVENT_TYPE.TICKET_ISSUED,
    fromStatus: event.status,
    toStatus: event.status,
    actor: ownerId,
    payload: { objectId: object.id },
  });
  bus.emit(bus.DOMAIN_EVENT.TICKET_ISSUED, { event, ownerId, objectId: object.id });
  return { ticket: object };
}

/**
 * Découverte d'une Lanterne par un citoyen : récompense Wallet + transition de
 * cycle de vie. Idempotent par citoyen (pas de double récompense).
 */
function discoverLantern(eventId, discovererUserId, io) {
  const event = getEventById(eventId);
  const result = orchestration.discoverLantern(event, discovererUserId, io);
  if (result.replayed) return { replayed: true, reward: null };

  journal(eventId, {
    type: JOURNAL_EVENT_TYPE.DISCOVERED,
    fromStatus: event.status,
    toStatus: event.status,
    actor: discovererUserId,
    payload: { rewardId: result.reward?.id || null },
  });
  // La Lanterne passe à « discovered » si son graphe l'autorise depuis l'état
  // courant (re-découvrable ensuite par d'autres habitants).
  const def = registry.getType(event.type);
  if (lifecycle.canTransition(def, event.status, 'discovered')) {
    transitionEvent(eventId, 'discovered', { actor: discovererUserId }, io);
  }
  bus.emit(bus.DOMAIN_EVENT.DISCOVERED, { event, discovererUserId, rewardId: result.reward?.id || null });
  return { replayed: false, reward: result.reward };
}

// ── Requêtes (lectures) ───────────────────────────────────────────────────────

/**
 * Enrichit une initiative projetée avec son régime de réservation résolu (places
 * restantes, prix), pour que la surface l'affiche SANS aucune règle métier. Ne
 * calcule la jauge que pour les initiatives réellement billetterie (canTicket).
 */
function withReservation(event) {
  if (!event) return event;
  if (!registry.hasCapability(event.type, 'canTicket')) return event;
  const resv = orchestration.reservationOf(event);
  const issued = orchestration.ticketsIssued(event.id);
  const seatsLeft = event.capacity != null ? Math.max(0, event.capacity - issued) : null;
  return {
    ...event,
    reservation: {
      required: resv.required,
      price: resv.price,
      currency: resv.currency,
      capacity: event.capacity ?? null,
      ticketsIssued: issued,
      seatsLeft,
      soldOut: seatsLeft === 0,
    },
  };
}

function getEventById(eventId) {
  const row = getRawEvent(eventId);
  if (!row) throw httpError(404, 'Initiative introuvable');
  return withReservation(rowToEvent(row));
}

/**
 * Liste d'initiatives filtrable (production côté Épée, admin, Lab).
 * Filtres : type, status, sourceKind, sourceId, storeId, channel, zoneId.
 */
function listEvents(filters = {}) {
  let sql = 'SELECT * FROM events WHERE 1=1';
  const args = [];
  if (filters.type) { sql += ' AND type = ?'; args.push(filters.type); }
  if (filters.status) { sql += ' AND status = ?'; args.push(filters.status); }
  if (filters.sourceKind) { sql += ' AND source_kind = ?'; args.push(filters.sourceKind); }
  if (filters.sourceId) { sql += ' AND source_id = ?'; args.push(filters.sourceId); }
  if (filters.storeId) { sql += ' AND store_id = ?'; args.push(filters.storeId); }
  if (filters.zoneId) { sql += ' AND zone_id = ?'; args.push(filters.zoneId); }
  sql += ' ORDER BY COALESCE(starts_at, created_at) DESC';
  let rows = db.prepare(sql).all(...args).map(rowToEvent);
  // Filtre par canal (stocké en JSON) : appliqué en mémoire pour rester générique.
  if (filters.channel) rows = rows.filter((e) => e.channels.includes(filters.channel));
  return rows;
}

/**
 * Projections de CONSOMMATION pour la Deuxième Âme (préparation Phase 7).
 *
 * Le cœur expose des requêtes ; la Deuxième Âme composera SES portes à partir de
 * ces projections (une porte = une vue filtrée sur le flux d'initiatives). Le
 * moteur ne connaît pas les portes : il reste un organe, pas une surface.
 *
 * « Découvrable » = visible par un habitant qui explore. Générique par type :
 * statuts de diffusion classiques (published/live/ended) + spécialisations
 * (Lanterne : active/discovered).
 */
function listDiscoverable(filters = {}) {
  const generic = lifecycle.DISCOVERABLE_STATUS;             // published, live, ended
  const lantern = ['active', 'discovered'];                  // spécialisation Lanterne
  const statuses = [...new Set([...generic, ...lantern])];
  const ph = statuses.map(() => '?').join(',');
  let rows = db.prepare(`SELECT * FROM events WHERE status IN (${ph}) AND visibility = 'public'`).all(...statuses).map(rowToEvent);

  if (filters.type) rows = rows.filter((e) => e.type === filters.type);
  if (filters.zoneId) rows = rows.filter((e) => e.zoneId === filters.zoneId);
  if (filters.channel) rows = rows.filter((e) => e.channels.includes(filters.channel));
  if (filters.capability) rows = rows.filter((e) => registry.hasCapability(e.type, filters.capability));

  // Ne pas exposer les Lanternes non actives via les portes génériques.
  rows = rows.filter((e) => {
    if (registry.hasCapability(e.type, 'isLantern')) return e.status === 'active' || e.status === 'discovered';
    return generic.includes(e.status);
  });

  rows.sort((a, b) => String(b.startsAt || b.createdAt).localeCompare(String(a.startsAt || a.createdAt)));
  return rows;
}

/** Projection « Murmures » : initiatives découvrables des types poétiques (isMurmur). */
function listMurmurs(filters = {}) {
  return listDiscoverable({ ...filters, capability: 'isMurmur' });
}

/**
 * Biographie de l'initiative : journal append-only complet.
 */
function getEventJournal(eventId) {
  const row = getRawEvent(eventId);
  if (!row) throw httpError(404, 'Initiative introuvable');
  return db
    .prepare('SELECT * FROM event_journal WHERE event_id = ? ORDER BY created_at ASC')
    .all(eventId)
    .map((e) => ({
      id: e.id,
      type: e.type,
      fromStatus: e.from_status,
      toStatus: e.to_status,
      actor: e.actor,
      payload: safeParse(e.payload),
      createdAt: e.created_at,
    }));
}

module.exports = {
  // Commandes
  createEvent,
  updateEvent,
  transitionEvent,
  publishEvent,
  cancelEvent,
  // Diffusion
  getModeReception,
  setModeReception,
  diffuseEvent,
  getEventDiffusions,
  listOpportunityInbox,
  countOpportunityInbox,
  acceptOpportunity,
  journalTicketIssued,
  dismissOpportunity,
  // Orchestration des organes
  issueTicket,
  discoverLantern,
  // Requêtes
  getEventById,
  listEvents,
  listDiscoverable,
  listMurmurs,
  getEventJournal,
  // Métadonnées du registre (lecture)
  listTypes: registry.listTypes,
  getChannels: registry.getChannels,
  // Hook interne (Phase 5)
  subscribe: bus.subscribe,
  DOMAIN_EVENT: bus.DOMAIN_EVENT,
  getInsights: subscribers.insights.snapshot,
  // Constantes utiles aux organes appelants
  EVENT_STATUS,
  SOURCE_KIND: registry.SOURCE_KIND,
  VISIBILITY: registry.VISIBILITY,
};
