/**
 * Organe Inventory — journal append-only des mouvements de stock (Loi 9).
 *
 * Pourquoi une table propre au lieu du journal générique du noyau : un mouvement de
 * stock est une quantité SIGNÉE et INTERROGEABLE. On doit pouvoir répondre à
 * « combien a-t-on réservé sur ce produit cette semaine » et recalculer un solde en
 * rejouant les mouvements. Avec le `payload` opaque du journal générique, ces deux
 * questions demanderaient de désérialiser toutes les lignes.
 *
 * Le journal ne décide de rien. Il enregistre, et il permet de rejouer.
 */

const db = require('../../db');

db.exec(`
  CREATE TABLE IF NOT EXISTS stock_movements (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL REFERENCES products(id),
    variant_id TEXT,
    kind TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    reason TEXT,
    origin TEXT NOT NULL,
    -- Traçabilité métier : quelle commande, quel connecteur, quel commerçant.
    reference TEXT,
    actor TEXT,
    -- État résultant, figé au moment du mouvement : c'est ce qui permet de
    -- diagnostiquer une divergence sans rejouer toute l'histoire.
    on_hand_after INTEGER NOT NULL,
    reserved_after INTEGER NOT NULL,
    occurred_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_stock_movements_product
    ON stock_movements(product_id, occurred_at);

  CREATE INDEX IF NOT EXISTS idx_stock_movements_reference
    ON stock_movements(reference)
    WHERE reference IS NOT NULL;
`);

/**
 * Enregistre un mouvement. À appeler DANS la transaction du mouvement.
 *
 * @param {object} movement
 * @param {string} movement.productId
 * @param {string|null} [movement.variantId]
 * @param {string} movement.kind      voir `policy.MOVEMENT_KIND`
 * @param {number} movement.quantity  quantité du mouvement, toujours positive
 * @param {string} movement.origin    voir `policy.MOVEMENT_ORIGIN`
 * @param {object} movement.level     état de la ligne APRÈS le mouvement
 * @param {string|null} [movement.reference] commande, import, session de caisse
 * @param {string|null} [movement.actor]
 * @param {string|null} [movement.reason]
 * @returns {string} identifiant du mouvement
 */
function append({
  productId, variantId = null, kind, quantity, origin, level,
  reference = null, actor = null, reason = null,
}) {
  const id = db.generateId();
  db.prepare(`
    INSERT INTO stock_movements
      (id, product_id, variant_id, kind, quantity, reason, origin, reference, actor,
       on_hand_after, reserved_after)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, productId, variantId, kind, quantity, reason, origin, reference, actor,
    level.on_hand, level.reserved
  );
  return id;
}

/** Historique d'un produit, du plus ancien au plus récent. */
function read(productId, { variantId = null, limit = 200 } = {}) {
  return db.prepare(`
    SELECT * FROM stock_movements
    WHERE product_id = ? AND COALESCE(variant_id, '') = COALESCE(?, '')
    ORDER BY occurred_at ASC, rowid ASC
    LIMIT ?
  `).all(productId, variantId, limit);
}

/** Mouvements liés à une référence métier (une commande, par exemple). */
function readByReference(reference) {
  return db.prepare(`
    SELECT * FROM stock_movements WHERE reference = ? ORDER BY occurred_at ASC, rowid ASC
  `).all(reference);
}

/**
 * Somme des quantités d'un type pour une référence.
 *
 * Sert à l'invariant qui compte le plus à l'annulation : on ne restitue que ce qui
 * a été réservé POUR CETTE COMMANDE, jamais un chiffre venu d'ailleurs.
 */
function totalFor(reference, kind) {
  const row = db.prepare(`
    SELECT COALESCE(SUM(quantity), 0) AS total
    FROM stock_movements WHERE reference = ? AND kind = ?
  `).get(reference, kind);
  return row.total;
}

module.exports = { append, read, readByReference, totalFor };
