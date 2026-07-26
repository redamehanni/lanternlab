/**
 * Routes commandes — traduction HTTP, rien d'autre.
 *
 * Avant l'étape 3, ce fichier contenait la logique de vente : décrément de stock,
 * calcul de prix, création de mission, conversation, notification, dispatch et
 * quatre émissions socket. Tout cela vit maintenant dans `lib/orders/`.
 *
 * Ce qu'une route fait ici : lire la requête, formuler l'intention ou appeler
 * l'organe, traduire le résultat ou l'erreur en code HTTP. Si une règle métier
 * réapparaît dans ce fichier, c'est qu'elle s'est échappée d'un moteur.
 *
 * Depuis l'étape 5, les actions qui traversent plusieurs organes passent par une
 * INTENTION nommée (`order.place`, `order.cancel`). La route ne connaît plus ni
 * l'ordre des effets, ni leurs compensations : elle nomme ce que l'utilisateur veut.
 */

const express = require('express');
const db = require('../db');
const { verifyToken, requireRole } = require('../middleware/auth');
const orders = require('../lib/orders');
const orchestration = require('../lib/orchestration');
const { canViewOrder, canChangeOrderStatus } = require('../lib/access');

const router = express.Router();

/** Contexte d'exécution d'une intention, déduit de la requête authentifiée. */
function intentContext(req) {
  return {
    actor: req.user.id,
    actorRole: req.user.role,
    io: req.app.get('io'),
    idempotencyKey: idempotencyKeyOf(req),
  };
}

/**
 * Noms de champs, côté HTTP historique, pour les paramètres d'intention.
 *
 * Les intentions parlent `productId`, cette API parle `product_id`. Un client à qui
 * l'on répond « paramètre manquant : productId » alors qu'il envoie `product_id`
 * cherchera son bug là où il n'est pas. Traduire le vocabulaire est exactement le
 * travail d'une route.
 */
const HTTP_FIELD = {
  productId: 'product_id',
  orderId: 'order_id',
  deliveryAddress: 'delivery_address',
  deliveryLat: 'delivery_lat',
  deliveryLng: 'delivery_lng',
};

/** Une erreur d'organe porte son propre code HTTP ; le reste est un 500. */
function fail(res, err) {
  if (!err?.status) throw err;

  let message = err.message;
  for (const [param, field] of Object.entries(HTTP_FIELD)) {
    message = message.replaceAll(param, field);
  }
  return res.status(err.status).json({ error: message });
}

/** Clé d'idempotence fournie par le client (Loi 10). Optionnelle à l'étape 3. */
function idempotencyKeyOf(req) {
  return req.get('Idempotency-Key') || req.body?.idempotency_key || null;
}

// POST /api/orders/cart — valider le panier (plusieurs articles)
router.post('/cart', verifyToken, requireRole('client'), (req, res) => {
  const { delivery_address, delivery_lat, delivery_lng } = req.body;

  try {
    const { orders: created, failed } = orders.placeCart({
      io: req.app.get('io'),
      clientId: req.user.id,
      deliveryAddress: delivery_address,
      deliveryLat: delivery_lat,
      deliveryLng: delivery_lng,
    });

    // Échec partiel : les commandes déjà passées existent, le panier garde le
    // reste. Le client voit ce qui a été validé ET ce qui a bloqué.
    if (failed) {
      return res.status(400).json({
        error: `Stock insuffisant pour ${failed.productName}`,
        orders: created,
      });
    }

    res.status(201).json({ orders: created });
  } catch (err) {
    fail(res, err);
  }
});

// POST /api/orders — le client passe commande
router.post('/', verifyToken, requireRole('client'), (req, res) => {
  const { product_id, quantity = 1, delivery_address, delivery_lat, delivery_lng } = req.body;

  try {
    const run = orchestration.run('order.place', {
      productId: product_id,
      quantity,
      deliveryAddress: delivery_address ?? null,
      deliveryLat: delivery_lat ?? null,
      deliveryLng: delivery_lng ?? null,
    }, intentContext(req));

    const created = run.results['orders.create'];
    const dispatched = run.results['dispatch.findDriver'];

    res.status(201).json({
      // Relu après le dispatch : le statut a pu changer entre les deux étapes.
      order: orders.getOrder(created.order.id),
      mission: dispatched?.mission || created.mission,
      dispatch: dispatched?.outcome || 'pending_driver',
      // Ce que Ma Zone n'a pas pu faire, dit au lieu d'être tu (Loi 12).
      pending: run.report,
    });
  } catch (err) {
    fail(res, err);
  }
});

// GET /api/orders/mine — commandes du client connecté
router.get('/mine', verifyToken, requireRole('client'), (req, res) => {
  const list = db.prepare(`
    SELECT o.*,
      p.name as product_name, p.image_url as product_image,
      s.name as store_name, s.address as store_address,
      m.id as mission_id, m.status as mission_status, m.driver_id,
      d.name as driver_name, d.phone as driver_phone
    FROM orders o
    JOIN products p ON o.product_id = p.id
    JOIN stores s ON o.store_id = s.id
    LEFT JOIN missions m ON m.order_id = o.id
    LEFT JOIN users d ON m.driver_id = d.id
    WHERE o.client_id = ?
    ORDER BY o.created_at DESC
  `).all(req.user.id);
  res.json({ orders: list });
});

// GET /api/orders/merchant — commandes de la boutique du commerçant
router.get('/merchant', verifyToken, requireRole('merchant'), (req, res) => {
  const store = db.prepare('SELECT * FROM stores WHERE merchant_id = ?').get(req.user.id);
  if (!store) return res.json({ orders: [] });

  const list = db.prepare(`
    SELECT o.*,
      u.name as client_name, u.phone as client_phone,
      p.name as product_name, p.image_url as product_image,
      m.id as mission_id, m.status as mission_status,
      d.name as driver_name
    FROM orders o
    JOIN users u ON o.client_id = u.id
    JOIN products p ON o.product_id = p.id
    LEFT JOIN missions m ON m.order_id = o.id
    LEFT JOIN users d ON m.driver_id = d.id
    WHERE o.store_id = ?
    ORDER BY o.created_at DESC
  `).all(store.id);
  res.json({ orders: list });
});

// GET /api/orders/:id
router.get('/:id', verifyToken, (req, res) => {
  const order = orders.getFullOrder(req.params.id);
  if (!order) return res.status(404).json({ error: 'Commande introuvable' });
  // 404 plutôt que 403 pour un tiers : l'existence d'une commande n'a pas à être
  // révélée à quelqu'un qui n'y est pas partie prenante.
  if (!canViewOrder(req.user, order.id)) {
    return res.status(404).json({ error: 'Commande introuvable' });
  }
  res.json({ order, cancellable: orders.lifecycle.canClientCancel(order.status) });
});

// GET /api/orders/:id/journal — histoire de la commande (Loi 9)
router.get('/:id/journal', verifyToken, (req, res) => {
  const order = orders.getFullOrder(req.params.id);
  if (!order || !canViewOrder(req.user, order.id)) {
    return res.status(404).json({ error: 'Commande introuvable' });
  }
  res.json({ journal: orders.readJournal(order.id) });
});

// POST /api/orders/:id/cancel — annulation client (avant sortie du colis)
router.post('/:id/cancel', verifyToken, requireRole('client'), (req, res) => {
  try {
    const run = orchestration.run('order.cancel', {
      orderId: req.params.id,
      reason: req.body?.reason || 'client_cancelled',
    }, intentContext(req));

    res.json({
      order: run.results['orders.cancel'].order,
      pending: run.report,
    });
  } catch (err) {
    fail(res, err);
  }
});

// GET /api/orders/:id/orchestration/:runId — déroulé d'une intention (Loi 9)
router.get('/:id/orchestration/:runId', verifyToken, (req, res) => {
  const order = orders.getFullOrder(req.params.id);
  if (!order || !canViewOrder(req.user, order.id)) {
    return res.status(404).json({ error: 'Commande introuvable' });
  }
  res.json({ run: orchestration.history(req.params.runId) });
});

// PATCH /api/orders/:id/status — changer le statut (commerçant ou livreur affecté)
router.patch('/:id/status', verifyToken, requireRole('merchant', 'driver'), (req, res) => {
  const { status } = req.body;
  if (!orders.lifecycle.isKnownStatus(status)) {
    return res.status(400).json({ error: 'Statut invalide' });
  }

  const order = orders.getFullOrder(req.params.id);
  if (!order) return res.status(404).json({ error: 'Commande introuvable' });
  // Le rôle ne suffit pas : il faut être le commerçant de CETTE boutique ou le
  // livreur de CETTE course.
  if (!canChangeOrderStatus(req.user, order.id)) {
    return res.status(403).json({ error: 'Vous n\'êtes pas partie prenante de cette commande' });
  }

  try {
    // Le graphe tranche : une transition impossible est un 409, et rien n'est écrit.
    res.json({ order: orders.transitionOrder(order.id, status, { actor: req.user.id }) });
  } catch (err) {
    fail(res, err);
  }
});

module.exports = router;
