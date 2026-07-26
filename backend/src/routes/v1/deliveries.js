/**
 * API v1 — livraisons, vues par le livreur qui les exécute.
 *
 * Une seule lecture pour l'instant, et volontairement. Faire avancer une course
 * (`picking_up`, `picked_up`, `delivering`, `delivered`) reste sur `/api` jusqu'à ce que
 * l'organe Delivery existe : ces transitions écrivent aujourd'hui dans `missions` ET dans
 * `orders`, depuis `routes/missions.js`, sans machine à états déclarée.
 *
 * LES EXPOSER EN v1 MAINTENANT SERAIT LE PIRE MOMENT. Un contrat public est une promesse
 * de stabilité : publier l'écriture d'une mécanique qu'on sait devoir refaire, c'est
 * s'interdire de la refaire — ou casser le contrat six mois après l'avoir signé. La règle
 * suivie ici est celle qui a rendu l'étape 7 possible : on ne versionne que ce qui est
 * passé derrière un organe.
 *
 * Le livreur n'est donc pas oublié : il lit ses courses ici, et les fait avancer par
 * l'API historique, qui fonctionne. La bascule viendra avec l'organe.
 */

const express = require('express');
const db = require('../../db');
const { verifyToken, requireRole } = require('../../middleware/auth');
const projections = require('./projections');

const router = express.Router();

/** Commission du livreur. Même taux que `lib/missions.js` et `/api/missions/stats`. */
const COMMISSION_RATE = 0.05;

const ACTIVE_STATUSES = ['accepted', 'picking_up', 'picked_up', 'delivering'];

// GET /api/v1/deliveries/mine — mes courses
//
// `active` est extrait plutôt que laissé à deviner : l'application livreur a besoin de
// savoir s'il y a une course en cours, et lui faire filtrer une liste selon quatre
// statuts reviendrait à publier une règle métier dans un client mobile.
router.get('/mine', verifyToken, requireRole('driver'), (req, res) => {
  const rows = db.prepare(`
    SELECT m.*,
      o.delivery_address, o.total_price, o.store_id,
      s.name as store_name, s.address as store_address
    FROM missions m
    JOIN orders o ON m.order_id = o.id
    JOIN stores s ON o.store_id = s.id
    WHERE m.driver_id = ?
    ORDER BY m.created_at DESC
    LIMIT ?
  `).all(req.user.id, Math.min(Number(req.query.limit) || 50, 200));

  const deliveries = rows.map((row) => projections.deliveryForDriver({
    ...row,
    commission: Math.round((row.total_price || 0) * COMMISSION_RATE * 100) / 100,
  }));

  res.json({
    deliveries,
    active: deliveries.find((d) => ACTIVE_STATUSES.includes(d.status)) || null,
  });
});

module.exports = router;
