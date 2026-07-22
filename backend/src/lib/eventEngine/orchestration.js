/**
 * Event Engine — Orchestration des organes (Wallet, Identity).
 *
 * PRINCIPE CARDINAL : l'Event Engine ORCHESTRE, il ne réimplémente jamais la
 * logique d'un autre organe et n'absorbe pas ses responsabilités.
 *  - Un billet / une récompense = un objet numérique → on APPELLE le Wallet.
 *  - La découverte d'une Lanterne = un citoyen identifié qui scanne → l'identité
 *    du scanneur est fournie par la couche d'authentification ; l'Event Engine
 *    réagit à l'issue du scan (récompense Wallet + transition de cycle de vie).
 *
 * Ce module ne connaît pas le cœur (`index.js`) : il reçoit l'initiative déjà
 * projetée et renvoie un résultat. Pas de cycle d'import.
 */

const db = require('../../db');
const registry = require('./eventRegistry');
const wallet = require('../walletEngine');

const SOURCE_ENGINE = 'event_engine';

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

/** Nombre de billets déjà émis pour une initiative (jauge). */
function ticketsIssued(eventId) {
  return db
    .prepare("SELECT COUNT(*) c FROM event_journal WHERE event_id = ? AND type = 'ticket_issued'")
    .get(eventId).c;
}

/**
 * Régime de réservation d'une initiative — CHOIX D'INSTANCE, pas de type.
 *
 * Modèle générique et extensible : le producteur déclare, à la création, comment
 * on participe à SON initiative, via `payload.reservation` (donnée opaque que le
 * cœur ne fait que transporter) :
 *   { mode: 'open' | 'ticket', price?: number, currency?: string }
 *  - 'open'   → participation libre, aucune réservation.
 *  - 'ticket' → réservation obligatoire (billet Wallet) ; `price` = 0 (gratuit)
 *               ou > 0 (payant). Extensible demain (waitlist, rôles, quotas…)
 *               en enrichissant cet objet, SANS nouveau type ni refonte du cœur.
 *
 * Rétrocompatibilité : une initiative billetterie historique (canTicket + jauge)
 * sans `reservation` explicite est traitée comme « réservation gratuite ».
 */
function reservationOf(event) {
  const r = event && event.payload && event.payload.reservation;
  if (r && (r.mode === 'ticket' || r.mode === 'open')) {
    return {
      required: r.mode === 'ticket',
      price: Number(r.price) || 0,
      currency: r.currency || 'EUR',
    };
  }
  if (event && event.capacity != null) {
    return { required: true, price: 0, currency: 'EUR' };
  }
  return { required: false, price: 0, currency: 'EUR' };
}

/**
 * Émet un billet pour une initiative billetterie (capability canTicket).
 * Le billet EST un objet Wallet : c'est le Wallet qui le gouverne. L'Event
 * Engine ne stocke aucun billet ; il oriente l'émission et respecte la jauge.
 *
 * @returns { object, replayed } — l'objet Wallet émis.
 */
function issueTicket(event, ownerId, io) {
  if (!event) throw httpError(404, 'Initiative introuvable');
  if (!registry.hasCapability(event.type, 'canTicket')) {
    throw httpError(409, `Le type "${event.type}" ne propose pas de billetterie`);
  }
  if (event.status !== 'published' && event.status !== 'live') {
    throw httpError(409, 'Billetterie ouverte uniquement sur une initiative publiée');
  }

  const resv = reservationOf(event);
  if (!resv.required) {
    throw httpError(409, 'Initiative ouverte à tous : aucune réservation nécessaire');
  }
  if (event.capacity != null && ticketsIssued(event.id) >= event.capacity) {
    throw httpError(409, 'Complet : jauge atteinte');
  }

  const priceLabel = resv.price > 0
    ? `${resv.price} ${resv.currency}`
    : 'Gratuit';

  const object = wallet.issueObject(
    {
      ownerId,
      // Le billet EST un objet Wallet : c'est le Wallet qui le gouverne. Le prix
      // et la devise voyagent dans le payload/affichage ; le RÈGLEMENT d'un billet
      // payant relèvera d'un organe Paiement (dépendance à venir), jamais du
      // moteur d'événements — d'où l'absence de logique monétaire ici.
      kind: 'event_ticket',
      payload: { eventId: event.id, type: event.type, price: resv.price, currency: resv.currency },
      display: {
        title: event.title,
        subtitle: event.display?.subtitle || event.summary || null,
        primaryDate: event.startsAt || null,
        category: 'culture',
        price: priceLabel,
      },
      sourceEngine: SOURCE_ENGINE,
      sourceRef: event.id,
      zoneId: event.zoneId || null,
    },
    io
  );

  return { object };
}

/** Un citoyen a-t-il déjà découvert cette Lanterne (anti double-récompense) ? */
function alreadyDiscovered(lanternId, userId) {
  return !!db
    .prepare("SELECT 1 FROM event_journal WHERE event_id = ? AND type = 'discovered' AND actor = ? LIMIT 1")
    .get(lanternId, userId);
}

/**
 * Découverte d'une Lanterne par un citoyen identifié. Orchestre :
 *  1. récompense Wallet (objet keepsake) émise au citoyen ;
 *  2. transition de cycle de vie active → discovered (re-découvrable ensuite).
 *
 * Idempotent par citoyen : re-scanner ne redonne jamais deux récompenses.
 *
 * @returns { reward, replayed }
 */
function discoverLantern(event, discovererUserId, io) {
  if (!event) throw httpError(404, 'Lanterne introuvable');
  if (!registry.hasCapability(event.type, 'isLantern')) {
    throw httpError(409, "Cette initiative n'est pas une Lanterne");
  }
  if (event.status === 'hidden') throw httpError(409, 'Lanterne pas encore active');
  if (event.status === 'retired') throw httpError(409, 'Lanterne retirée');

  if (alreadyDiscovered(event.id, discovererUserId)) {
    return { replayed: true, reward: null };
  }

  const reward = wallet.issueObject(
    {
      ownerId: discovererUserId,
      kind: 'badge',
      payload: { lanternId: event.id },
      display: {
        title: event.title,
        subtitle: 'Lanterne découverte',
        category: 'lanterne',
      },
      sourceEngine: SOURCE_ENGINE,
      sourceRef: event.id,
      zoneId: event.zoneId || null,
    },
    io
  );

  return { replayed: false, reward };
}

module.exports = {
  issueTicket,
  discoverLantern,
  ticketsIssued,
  reservationOf,
  alreadyDiscovered,
  SOURCE_ENGINE,
};
