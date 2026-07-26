/**
 * Orchestration — adaptateur de l'organe Event.
 *
 * L'Event Engine garde toute sa logique : cycle de vie, registre de types,
 * diffusion, journal. On l'appelle, on ne le réécrit pas.
 */

const db = require('../../../db');
const eventEngine = require('../../eventEngine');

/**
 * Publie une annonce de fermeture exceptionnelle.
 *
 * Créée PUIS publiée en deux appels : une initiative naît en brouillon, et forcer
 * un statut initial contournerait le cycle de vie de l'Event Engine.
 */
function announceClosure(params, ctx) {
  const store = db.prepare('SELECT * FROM stores WHERE id = ?').get(params.storeId);
  if (!store) {
    const err = new Error('Boutique introuvable');
    err.status = 404;
    throw err;
  }

  const created = eventEngine.createEvent({
    type: 'annonce_boutique',
    sourceKind: 'merchant',
    sourceId: store.merchant_id,
    title: `${store.name} — fermeture exceptionnelle`,
    summary: params.reason || 'La boutique est fermée aujourd\'hui.',
    startsAt: params.until || null,
    lat: store.lat,
    lng: store.lng,
    address: store.address,
    storeId: store.id,
    payload: { reason: params.reason || null, until: params.until || null },
  }, ctx.io);

  const published = eventEngine.publishEvent(created.id, { actor: ctx.actor }, ctx.io);
  return { eventId: created.id, status: published?.status || 'published' };
}

/** Retire l'annonce publiée par l'étape compensée. */
function retractAnnouncement(params, ctx) {
  const eventId = ctx.results['events.announceClosure']?.eventId;
  if (!eventId) return { retracted: false };
  eventEngine.cancelEvent(eventId, { actor: ctx.actor }, ctx.io);
  return { retracted: true, eventId };
}

/**
 * Charge l'opportunité reçue et l'initiative derrière elle.
 *
 * Première étape du plan parce qu'une initiative retirée ou complète doit être
 * refusée AVANT qu'un objet numérique soit émis au nom de quelqu'un.
 */
function loadOpportunity(params) {
  const diffusion = require('../../eventEngine/diffusion');
  const inbox = diffusion.getInboxItem(params.inboxId, params.ownerId);
  return { inbox, event: eventEngine.getEventById(inbox.event_id) };
}

/**
 * Acte l'acceptation : journal de l'initiative et reçu marqué accepté.
 *
 * Dernière étape non compensée, et c'est le point de tout l'exercice. Avant l'étape 5,
 * cette écriture venait APRÈS l'émission du billet sans filet : si elle échouait,
 * l'habitant gardait un billet pour une acceptation qui n'existait nulle part.
 * Désormais son échec révoque le billet.
 */
function markOpportunityAccepted(params, ctx) {
  const diffusion = require('../../eventEngine/diffusion');
  const claimed = ctx.results['wallet.claimOpportunity'];
  const event = ctx.results['events.loadOpportunity'].event;

  if (claimed.kind === 'event_ticket') {
    eventEngine.journalTicketIssued(event, params.ownerId, claimed.objectId, ctx.io);
  }
  diffusion.markInboxAccepted(params.inboxId, params.ownerId, { ticketObjectId: claimed.objectId });

  return { inboxId: params.inboxId, objectId: claimed.objectId };
}

module.exports = {
  announceClosure,
  retractAnnouncement,
  loadOpportunity,
  markOpportunityAccepted,
};
