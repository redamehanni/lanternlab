/**
 * Organe Inventory — reprise de l'existant (jalon T0).
 *
 * Le problème que cette migration résout est subtil et vaut d'être écrit noir sur
 * blanc. Avant l'étape 4, une commande en cours avait DÉJÀ décrémenté
 * `products.quantity`. La réservation était donc invisible : elle était fondue dans
 * le stock physique.
 *
 * Reprendre naïvement `on_hand = products.quantity` et `reserved = 0` donnerait le
 * bon affichage mais rendrait toute annulation impossible : l'organe refuserait de
 * libérer une réservation dont il n'a aucune trace. On reconstitue donc les deux
 * valeurs :
 *
 *     on_hand  = products.quantity + réservations encore ouvertes
 *     reserved = réservations encore ouvertes
 *     available = products.quantity   ← l'affichage ne change pas d'une unité
 *
 * Idempotente : un produit déjà repris est laissé tel quel. Elle peut donc tourner
 * à chaque démarrage sans risque.
 */

const db = require('../../db');
const { txn } = require('../kernel');
const levels = require('./stockLevels');
const movements = require('./movements');
const {
  INVENTORY_OWNER,
  MOVEMENT_KIND,
  MOVEMENT_ORIGIN,
  computeAvailable,
} = require('./policy');

/** Statuts où la marchandise est encore promise mais pas encore partie. */
const OPEN_ORDER_STATUSES = [
  'placed', 'pending_driver', 'driver_assigned', 'picking_up',
  // Statuts historiques rencontrés en base.
  'pending', 'searching_driver', 'offered', 'accepted', 'accepted_by_driver',
];

function openReservations() {
  const placeholders = OPEN_ORDER_STATUSES.map(() => '?').join(',');
  const rows = db.prepare(`
    SELECT product_id, id AS order_id, quantity
    FROM orders
    WHERE status IN (${placeholders})
    ORDER BY created_at ASC
  `).all(...OPEN_ORDER_STATUSES);

  const byProduct = new Map();
  for (const row of rows) {
    if (!byProduct.has(row.product_id)) byProduct.set(row.product_id, []);
    byProduct.get(row.product_id).push(row);
  }
  return byProduct;
}

/**
 * Reprend tous les produits qui n'ont pas encore de ligne de stock.
 *
 * @returns {{ adopted: number, reservationsRebuilt: number, skipped: number }}
 */
function backfill() {
  const products = db.prepare('SELECT id, quantity FROM products').all();
  const reservations = openReservations();

  const report = { adopted: 0, reservationsRebuilt: 0, skipped: 0 };

  for (const product of products) {
    if (levels.find(product.id)) {
      report.skipped += 1;
      continue;
    }

    const open = reservations.get(product.id) || [];
    const reserved = open.reduce((sum, order) => sum + order.quantity, 0);
    const onHand = (product.quantity ?? 0) + reserved;

    txn.run(() => {
      db.prepare(`
        INSERT INTO stock_levels
          (id, product_id, variant_id, on_hand, reserved, safety_buffer, inventory_owner)
        VALUES (?, ?, NULL, ?, ?, 0, ?)
      `).run(db.generateId(), product.id, onHand, reserved, INVENTORY_OWNER.MAZONE);

      const level = levels.find(product.id);

      // Un mouvement par commande ouverte, avec sa référence : c'est ce qui rend
      // l'annulation d'une commande antérieure à l'étape 4 possible.
      for (const order of open) {
        movements.append({
          productId: product.id,
          kind: MOVEMENT_KIND.RESERVE,
          quantity: order.quantity,
          origin: MOVEMENT_ORIGIN.MAZONE,
          level,
          reference: order.order_id,
          reason: 'reprise T0 — réservation reconstituée',
        });
        report.reservationsRebuilt += 1;
      }

      levels.project(level);
    });

    report.adopted += 1;
  }

  return report;
}

/**
 * Contrôle d'intégrité : la projection dit-elle la vérité ?
 *
 * La projection `products.quantity` est une double écriture, donc un risque de
 * désynchronisation assumé. Cette fonction est le filet : elle liste les écarts
 * sans rien corriger, pour qu'une correction reste une décision.
 *
 * @returns {{ productId: string, projected: number, computed: number }[]}
 */
function findProjectionDrift() {
  const rows = db.prepare(`
    SELECT sl.product_id, sl.on_hand, sl.reserved, sl.safety_buffer, p.quantity AS projected
    FROM stock_levels sl
    JOIN products p ON p.id = sl.product_id
    WHERE sl.variant_id IS NULL
  `).all();

  return rows
    .map((row) => ({ productId: row.product_id, projected: row.projected, computed: computeAvailable(row) }))
    .filter((row) => row.projected !== row.computed);
}

/** Réaligne les projections divergentes. Action explicite, jamais automatique. */
function repairProjectionDrift() {
  const drift = findProjectionDrift();
  txn.run(() => {
    for (const item of drift) levels.recompute(item.productId);
  });
  return drift;
}

module.exports = { backfill, findProjectionDrift, repairProjectionDrift, OPEN_ORDER_STATUSES };
