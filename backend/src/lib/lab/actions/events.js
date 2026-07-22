/**
 * Actions de labo — Organe Event Engine.
 *
 * Ces actions n'implémentent AUCUNE logique métier : elles délèguent à l'Event
 * Engine (createEvent / publishEvent / diffuseEvent). C'est exactement le chemin
 * qu'un producteur emprunte en production. La cible (`targetUserId`) est un
 * acteur démo (garde appliquée par la route).
 */

const db = require('../../../db');
const { defineAction } = require('../actionRegistry');
const events = require('../../eventEngine');

const typeOptions = events.listTypes().map((t) => ({ value: t.type, label: t.label }));
const channelOptions = events.getChannels().map((c) => ({ value: c.id, label: c.label }));

const RESERVATION_OPTIONS = [
  { value: 'open', label: 'Ouvert à tous (aucune réservation)' },
  { value: 'ticket_free', label: 'Places limitées — billet gratuit' },
  { value: 'ticket_paid', label: 'Places limitées — billet payant' },
];

/** Contexte de production d'un acteur démo (source + rattachement). */
function productionFor(userId) {
  const user = db.prepare('SELECT id, role FROM users WHERE id = ?').get(userId);
  if (!user) throw Object.assign(new Error('Acteur introuvable'), { status: 404 });
  if (user.role === 'merchant') {
    const store = db.prepare('SELECT id FROM stores WHERE merchant_id = ?').get(userId);
    return { sourceKind: 'merchant', sourceId: store?.id || userId, storeId: store?.id || null };
  }
  return { sourceKind: 'citizen', sourceId: userId, storeId: null };
}

/** Traduit le choix de réservation du labo en payload générique de l'organe. */
function buildReservation(mode, price) {
  if (mode === 'ticket_free') return { mode: 'ticket', price: 0, currency: 'EUR' };
  if (mode === 'ticket_paid') return { mode: 'ticket', price: Number(price) || 0, currency: 'EUR' };
  return { mode: 'open' };
}

defineAction({
  id: 'create_event',
  label: 'Créer une initiative',
  description: "Demande à l'Event Engine de créer une initiative locale au nom de l'acteur ciblé (ouverte, ou à places limitées gratuite/payante).",
  organ: 'events',
  params: {
    type: { type: 'enum', label: "Type d'initiative", options: typeOptions, required: true },
    title: { type: 'text', label: 'Titre', required: true },
    summary: { type: 'text', label: 'Résumé', required: false },
    reservation: { type: 'enum', label: 'Participation', options: RESERVATION_OPTIONS, required: false },
    price: { type: 'number', label: 'Prix (si payant, en €)', required: false },
    capacity: { type: 'number', label: 'Places (jauge, optionnel)', required: false },
    channels: { type: 'multi', label: 'Canaux de diffusion', options: channelOptions, required: false },
    publish: { type: 'boolean', label: 'Publier immédiatement', required: false },
  },
  run({ targetUserId, params = {}, io }) {
    const prod = productionFor(targetUserId);
    const reservation = buildReservation(params.reservation || 'open', params.price);
    const capacity = params.capacity != null && params.capacity !== ''
      ? Number(params.capacity)
      : (reservation.mode === 'ticket' ? null : null);
    const created = events.createEvent(
      {
        type: params.type,
        sourceKind: prod.sourceKind,
        sourceId: prod.sourceId,
        storeId: prod.storeId,
        title: params.title,
        summary: params.summary || null,
        channels: params.channels && params.channels.length ? params.channels : null,
        capacity: Number.isFinite(capacity) ? capacity : null,
        payload: { reservation },
      },
      io
    );
    if (params.publish) return events.publishEvent(created.id, { actor: targetUserId }, io);
    return created;
  },
});

defineAction({
  id: 'set_mode_reception',
  label: 'Régler le Mode Réception',
  description: "Définit les canaux d'écoute de l'habitant ciblé (audience des Opportunités Volantes).",
  organ: 'events',
  params: {
    channels: { type: 'multi', label: "Canaux d'écoute", options: channelOptions, required: false },
  },
  run({ targetUserId, params = {} }) {
    const subs = (params.channels || []).map((channel) => ({ channel }));
    return events.setModeReception(targetUserId, subs);
  },
});

defineAction({
  id: 'issue_ticket',
  label: 'Réserver un billet',
  description: "Demande au Wallet (via l'Event Engine) d'émettre un billet à l'habitant pour une initiative billetterie.",
  organ: 'events',
  params: {
    eventId: { type: 'text', label: "Identifiant de l'initiative", required: true },
  },
  run({ params = {}, targetUserId, io }) {
    return events.issueTicket(params.eventId, targetUserId, io);
  },
});

defineAction({
  id: 'discover_lantern',
  label: 'Découvrir une Lanterne',
  description: "Simule le scan d'une Lanterne par l'habitant ciblé (récompense Wallet + transition).",
  organ: 'events',
  params: {
    eventId: { type: 'text', label: "Identifiant de la Lanterne", required: true },
  },
  run({ params = {}, targetUserId, io }) {
    return events.discoverLantern(params.eventId, targetUserId, io);
  },
});

defineAction({
  id: 'publish_event',
  label: 'Publier une initiative',
  description: "Demande à l'Event Engine de publier une initiative existante.",
  organ: 'events',
  params: {
    eventId: { type: 'text', label: "Identifiant de l'initiative", required: true },
  },
  run({ params = {}, targetUserId, io }) {
    return events.publishEvent(params.eventId, { actor: targetUserId }, io);
  },
});

defineAction({
  id: 'diffuse_event',
  label: 'Diffuser (Opportunité Volante)',
  description: "Demande à l'Event Engine de porter activement une initiative vers les habitants abonnés.",
  organ: 'events',
  params: {
    eventId: { type: 'text', label: "Identifiant de l'initiative", required: true },
    channels: { type: 'multi', label: 'Canaux ciblés', options: channelOptions, required: false },
    note: { type: 'text', label: 'Note de diffusion', required: false },
  },
  run({ params = {}, targetUserId, io }) {
    return events.diffuseEvent(
      params.eventId,
      { channels: params.channels || null, note: params.note || null, actor: targetUserId },
      io
    );
  },
});
