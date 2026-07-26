/**
 * API v1 — catalogue, vu par un acheteur.
 *
 * Trois lectures, une seule audience. Tout ce qui sort d'ici passe par
 * `projections.productForClient` ou `storeForAnyone` : aucune ligne de base ne part
 * telle quelle, et c'est ce qui rend la fuite de `on_hand` structurellement impossible
 * plutôt que simplement improbable.
 *
 * `available` vient de l'organe Inventory, jamais de `products.quantity`. La différence
 * est invisible aujourd'hui — la colonne est la projection du même nombre — et elle sera
 * tout ce qui reste le jour où la colonne disparaîtra (échéance inscrite dans
 * `lib/sunset.js`). Une surface neuve qui lirait la projection ferait dépendre l'API
 * publique d'un champ dont la mort est déjà datée.
 *
 * LECTURE DIRECTE DE `stores` — ASSUMÉE. Il n'existe pas encore d'organe Stores : une
 * boutique se crée et s'édite par `routes/stores.js`, sans journal ni cycle de vie. Y
 * lire directement est donc une exception bornée, à deux conditions qui sont tenues ici :
 * aucune écriture, et aucune décision. Le jour où un organe Stores existe, ces trois
 * requêtes deviennent des appels de façade et rien d'autre ne change.
 */

const express = require('express');
const db = require('../../db');
const { verifyToken } = require('../../middleware/auth');
const catalog = require('../../lib/catalog');
const inventory = require('../../lib/inventory');
const promotions = require('../../lib/promotions');
const projections = require('./projections');

const router = express.Router();

/** Distance à vol d'oiseau, en km. Sert au tri, pas à un itinéraire. */
function distanceKm(lat1, lng1, lat2, lng2) {
  if (!lat1 || !lng1 || !lat2 || !lng2) return null;
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 10) / 10;
}

/** Assemble la fiche client d'un produit : catalogue + vendable + promotion. */
function clientProduct(row) {
  return projections.productForClient(row, {
    available: inventory.getSellableQty(row.id),
    promotion: promotions.formatPromotion(promotions.getActivePromotion(row.id)),
  });
}

// GET /api/v1/stores — boutiques, les plus proches d'abord si on sait où l'on est
router.get('/stores', verifyToken, (req, res) => {
  const lat = req.query.lat ? Number(req.query.lat) : null;
  const lng = req.query.lng ? Number(req.query.lng) : null;
  const radius = req.query.radius_km ? Number(req.query.radius_km) : null;

  const rows = db.prepare('SELECT * FROM stores ORDER BY created_at DESC LIMIT 200').all();

  const stores = rows
    .map((row) => projections.storeForAnyone(row, {
      distanceKm: distanceKm(lat, lng, row.lat, row.lng),
    }))
    // Le rayon ne filtre que ce qu'on sait situer : écarter une boutique sans
    // coordonnées la rendrait invisible pour toujours, ce qui est pire que mal triée.
    .filter((store) => radius === null || store.distance_km === null || store.distance_km <= radius)
    .sort((a, b) => (a.distance_km ?? Infinity) - (b.distance_km ?? Infinity));

  res.json({ stores });
});

// GET /api/v1/stores/:storeId — une boutique
router.get('/stores/:storeId', verifyToken, (req, res) => {
  const row = db.prepare('SELECT * FROM stores WHERE id = ?').get(req.params.storeId);
  if (!row) return res.status(404).json({ error: 'Boutique introuvable' });
  res.json({ store: projections.storeForAnyone(row) });
});

// GET /api/v1/stores/:storeId/products — le catalogue d'une boutique
router.get('/stores/:storeId/products', verifyToken, (req, res) => {
  const store = db.prepare('SELECT id FROM stores WHERE id = ?').get(req.params.storeId);
  if (!store) return res.status(404).json({ error: 'Boutique introuvable' });

  const products = catalog.listForStore(req.params.storeId).map(clientProduct);
  res.json({ products });
});

// GET /api/v1/products/:productId — une fiche produit
router.get('/products/:productId', verifyToken, (req, res) => {
  const row = catalog.getProduct(req.params.productId);
  // Un produit retiré de la vente répond 404 à un acheteur : il n'a pas à distinguer
  // « n'existe pas » de « n'est plus proposé », et le commerçant a ses propres écrans.
  if (!row || !row.active) return res.status(404).json({ error: 'Produit introuvable' });

  res.json({ product: clientProduct(row) });
});

module.exports = router;
