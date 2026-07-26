/**
 * API v1 — commandes, en lecture seule.
 *
 * Aucune écriture ici, et c'est le point. Passer commande touche Orders, Dispatch et
 * — quand la boutique en a la capacité — l'intégration : trois organes, donc une
 * intention (`POST /api/v1/intents/order.place`). Annuler, de même. Une route
 * `POST /api/v1/orders` existerait uniquement pour ressembler aux API qu'on connaît, et
 * elle rouvrirait le chemin par lequel une surface se met à composer des organes.
 *
 * C'est le critère que l'audit de la roadmap oppose à cette étape : « `/api/v1` devient un
 * miroir de tables au lieu d'un contrat d'intentions ». La réponse tient en une règle
 * vérifiable — dans `routes/v1/`, un verbe d'écriture ne s'écrit que dans `intents.js`, et
 * dans `inventory.js` qui ne touche qu'un organe.
 *
 * ACCÈS : `lib/access.js`, partagé avec `/api` et avec les sockets. Trois surfaces qui
 * poseraient la même question à trois endroits finiraient par avoir trois réponses.
 */

const express = require('express');
const { verifyToken } = require('../../middleware/auth');
const access = require('../../lib/access');
const orders = require('../../lib/orders');
const projections = require('./projections');

const router = express.Router();

// GET /api/v1/orders/mine — mes commandes, en tant qu'acheteur
//
// Déclarée avant `/:orderId`, sinon « mine » serait pris pour un identifiant.
router.get('/mine', verifyToken, (req, res) => {
  const list = orders
    .listOrders({ clientId: req.user.id, limit: Math.min(Number(req.query.limit) || 50, 200) })
    .map(projections.orderForParty);

  res.json({ orders: list });
});

// GET /api/v1/orders?store_id=… — les commandes d'une boutique
router.get('/', verifyToken, (req, res) => {
  const storeId = req.query.store_id;
  if (!storeId) return res.status(400).json({ error: 'Paramètre store_id requis' });
  if (!access.isStoreMember(req.user.id, storeId)) {
    return res.status(404).json({ error: 'Boutique introuvable' });
  }

  const list = orders
    .listOrders({ storeId, limit: Math.min(Number(req.query.limit) || 50, 200) })
    .map(projections.orderForParty);

  res.json({ store_id: storeId, orders: list });
});

// GET /api/v1/orders/:orderId — une commande, pour ses parties prenantes
router.get('/:orderId', verifyToken, (req, res) => {
  // 404 pour un tiers, jamais 403 : l'existence d'une commande n'est pas une information
  // publique. Le livreur destinataire d'une offre est inclus par `access` — il doit voir
  // la course pour décider de l'accepter.
  if (!access.canViewOrder(req.user, req.params.orderId)) {
    return res.status(404).json({ error: 'Commande introuvable' });
  }

  const row = orders.getFullOrder(req.params.orderId);
  if (!row) return res.status(404).json({ error: 'Commande introuvable' });

  res.json({ order: projections.orderForParty(row) });
});

// GET /api/v1/orders/:orderId/journal — la biographie d'une commande
//
// Ce qui n'est pas journalisé n'est pas arrivé (Loi 9). Cette route est ce qui rend la loi
// utile à quelqu'un : elle répond à « pourquoi ma commande est dans cet état », sans
// qu'un humain ait à ouvrir la base.
router.get('/:orderId/journal', verifyToken, (req, res) => {
  if (!access.canViewOrder(req.user, req.params.orderId)) {
    return res.status(404).json({ error: 'Commande introuvable' });
  }

  const entries = orders.readJournal(req.params.orderId).map((entry) => ({
    id: entry.id,
    type: entry.type,
    from_status: entry.from_status ?? null,
    to_status: entry.to_status ?? null,
    actor: entry.actor ?? null,
    created_at: entry.created_at,
  }));

  res.json({ order_id: req.params.orderId, journal: entries });
});

module.exports = router;
