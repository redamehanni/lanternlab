/**
 * Organe Inventory — la table `stock_levels` et sa projection.
 *
 * C'est le SEUL fichier du système autorisé à écrire `products.quantity`. Ce champ
 * n'est plus une vérité : c'est une projection de `available`, entretenue pour que
 * les sept écrans client et deux écrans commerçant qui la lisent n'aient pas à
 * changer d'une ligne. La bascule mobile viendra à l'étape 7, avec l'API v1.
 *
 * Une projection est une double écriture, donc un risque de désynchronisation
 * assumé : `recompute` la refait à partir du calcul, et un test la compare après
 * chaque mouvement.
 */

const db = require('../../db');
const {
  INVENTORY_OWNER,
  computeAvailable,
  assertStockCount,
  InventoryError,
} = require('./policy');

db.exec(`
  CREATE TABLE IF NOT EXISTS stock_levels (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL REFERENCES products(id),
    variant_id TEXT,
    on_hand INTEGER NOT NULL DEFAULT 0,
    reserved INTEGER NOT NULL DEFAULT 0,
    safety_buffer INTEGER NOT NULL DEFAULT 0,
    inventory_owner TEXT NOT NULL DEFAULT '${INVENTORY_OWNER.MAZONE}',
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- COALESCE et non (product_id, variant_id) : en SQLite deux NULL sont
  -- distincts, donc un index nu laisserait créer autant de lignes « produit sans
  -- déclinaison » qu'on veut, et le stock deviendrait ambigu.
  CREATE UNIQUE INDEX IF NOT EXISTS idx_stock_levels_key
    ON stock_levels(product_id, COALESCE(variant_id, ''));
`);

const SELECT_LEVEL = `
  SELECT * FROM stock_levels
  WHERE product_id = ? AND COALESCE(variant_id, '') = COALESCE(?, '')
`;

/** Ligne de stock, ou `null`. Lecture brute, sans effet de bord. */
function find(productId, variantId = null) {
  const row = db.prepare(SELECT_LEVEL).get(productId, variantId);
  return row ? decorate(row) : null;
}

/** Ajoute les valeurs dérivées. `available` n'existe qu'ici, jamais en base. */
function decorate(row) {
  return { ...row, available: computeAvailable(row) };
}

/**
 * Ligne de stock, créée au besoin.
 *
 * La création paresseuse est ce qui permet à l'organe de fonctionner sur une base
 * qui n'a jamais connu `stock_levels` : un produit dont le stock n'a jamais été
 * touché est adopté à son premier mouvement, avec son `products.quantity` comme
 * `on_hand` de départ.
 */
function ensure(productId, variantId = null, { onHand = null } = {}) {
  const existing = find(productId, variantId);
  if (existing) return existing;

  const product = db.prepare('SELECT quantity FROM products WHERE id = ?').get(productId);
  if (!product) throw new InventoryError('Produit introuvable', 404);

  const initial = onHand === null ? (product.quantity ?? 0) : assertStockCount(onHand, 'quantité');

  db.prepare(`
    INSERT INTO stock_levels (id, product_id, variant_id, on_hand, reserved, safety_buffer, inventory_owner)
    VALUES (?, ?, ?, ?, 0, 0, ?)
  `).run(db.generateId(), productId, variantId, initial, INVENTORY_OWNER.MAZONE);

  const level = find(productId, variantId);
  project(level);
  return level;
}

/**
 * Écrit les compteurs d'une ligne et rafraîchit la projection.
 *
 * Point de passage unique : toute modification de `on_hand`, `reserved` ou
 * `safety_buffer` traverse cette fonction, ce qui garantit que la projection ne
 * peut pas être oubliée.
 */
function write(level, { on_hand, reserved, safety_buffer }) {
  const next = {
    on_hand: on_hand ?? level.on_hand,
    reserved: reserved ?? level.reserved,
    safety_buffer: safety_buffer ?? level.safety_buffer,
  };

  if (next.on_hand < 0) throw new InventoryError('Le stock physique ne peut pas être négatif.', 409);
  if (next.reserved < 0) throw new InventoryError('Les réservations ne peuvent pas être négatives.', 409);

  db.prepare(`
    UPDATE stock_levels
    SET on_hand = ?, reserved = ?, safety_buffer = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(next.on_hand, next.reserved, next.safety_buffer, level.id);

  const updated = { ...level, ...next, available: computeAvailable(next) };
  project(updated);
  return updated;
}

/**
 * Recopie `available` dans `products.quantity`.
 *
 * L'UNIQUE `UPDATE products SET quantity` du backend. Tout autre occurrence est une
 * violation de la Loi 11 : personne d'autre n'a le droit d'écrire un champ calculé.
 */
function project(level) {
  db.prepare('UPDATE products SET quantity = ? WHERE id = ?').run(level.available, level.product_id);
}

/** Recalcule la projection depuis la vérité. Filet contre la désynchronisation. */
function recompute(productId, variantId = null) {
  const level = find(productId, variantId);
  if (!level) return null;
  project(level);
  return level;
}

/** Change le mode de propriété du stock physique. */
function setInventoryOwner(productId, owner, variantId = null) {
  const level = ensure(productId, variantId);
  db.prepare("UPDATE stock_levels SET inventory_owner = ?, updated_at = datetime('now') WHERE id = ?")
    .run(owner, level.id);
  return find(productId, variantId);
}

/** Change le tampon de sécurité commercial. */
function setSafetyBuffer(productId, buffer, variantId = null) {
  const level = ensure(productId, variantId);
  return write(level, { safety_buffer: assertStockCount(buffer, 'réserve de sécurité') });
}

/** Toutes les lignes d'une boutique. Écran commerçant et réconciliation. */
function listForStore(storeId) {
  return db.prepare(`
    SELECT sl.*, p.name as product_name
    FROM stock_levels sl
    JOIN products p ON sl.product_id = p.id
    WHERE p.store_id = ?
    ORDER BY p.name
  `).all(storeId).map(decorate);
}

module.exports = {
  find,
  ensure,
  write,
  project,
  recompute,
  setInventoryOwner,
  setSafetyBuffer,
  listForStore,
  decorate,
};
