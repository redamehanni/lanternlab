const db = require('../db');

/** Désactive automatiquement les promotions expirées ou épuisées */
function expirePromotions() {
  db.prepare(`
    UPDATE promotions SET active = 0
    WHERE active = 1 AND (
      (ends_at IS NOT NULL AND ends_at <= datetime('now'))
      OR (remaining_quantity IS NOT NULL AND remaining_quantity <= 0)
    )
  `).run();
}

/** Promotion active pour un produit (discount ou buy_get) */
function getActivePromotion(productId) {
  expirePromotions();
  return db.prepare(`
    SELECT * FROM promotions
    WHERE product_id = ? AND active = 1
      AND (ends_at IS NULL OR ends_at > datetime('now'))
      AND (remaining_quantity IS NULL OR remaining_quantity > 0)
    ORDER BY created_at DESC
    LIMIT 1
  `).get(productId);
}

function getSoldCount(promo) {
  if (promo.max_quantity == null) return promo.sold_count || 0;
  const remaining = promo.remaining_quantity ?? promo.max_quantity;
  return Math.max(0, promo.max_quantity - remaining);
}

function getPromoStatus(promo) {
  if (!promo.active) return 'ended';
  if (promo.ends_at && promo.ends_at <= new Date().toISOString().slice(0, 19).replace('T', ' ')) return 'ended';
  if (promo.remaining_quantity != null && promo.remaining_quantity <= 0) return 'ended';
  return 'active';
}

function formatPromotion(promo) {
  if (!promo) return null;
  const status = getPromoStatus(promo);
  const saved = promo.original_price && promo.promo_price
    ? Math.round((1 - promo.promo_price / promo.original_price) * 100)
    : promo.discount_percent;

  return {
    ...promo,
    status,
    sold_count: getSoldCount(promo),
    saved_percent: saved,
    promo_label: promo.type === 'buy_get'
      ? `${promo.get_quantity} offert(s) pour ${promo.buy_quantity}`
      : (saved ? `-${saved}%` : 'PROMO'),
  };
}

/**
 * Promotion flash enrichie avec les champs produit normalisés.
 * Le stock provient TOUJOURS du produit original (jamais d'une copie promo).
 */
function formatFlashPromotion(row) {
  const formatted = formatPromotion(row);
  if (!formatted) return null;

  const quantity = row.product_stock ?? row.quantity ?? 0;

  return {
    ...formatted,
    quantity,
    product_stock: quantity,
    name: row.product_name,
    image_url: row.product_image,
    price: row.product_price ?? row.original_price ?? row.price,
    description: row.product_description ?? null,
    store: {
      id: row.store_id,
      name: row.store_name,
      address: row.store_address,
      lat: row.store_lat,
      lng: row.store_lng,
    },
  };
}

/** Enrichit un produit avec sa promotion active */
function enrichProductWithPromo(product) {
  const promo = getActivePromotion(product.id);
  const formatted = formatPromotion(promo);

  return {
    ...product,
    promotion: formatted,
    promo_id: formatted?.id ?? null,
    promo_type: formatted?.type ?? null,
    promo_price: formatted?.type === 'discount' ? formatted.promo_price : null,
    original_price: formatted?.original_price ?? null,
    discount_percent: formatted?.discount_percent ?? null,
    promo_label: formatted?.promo_label ?? null,
    buy_quantity: formatted?.buy_quantity ?? null,
    get_quantity: formatted?.get_quantity ?? null,
  };
}

/** Prix unitaire effectif (promo discount appliquée) */
function getEffectivePrice(product, promo) {
  const p = promo || getActivePromotion(product.id);
  if (p?.type === 'discount' && p.promo_price != null) return p.promo_price;
  return product.price;
}

/**
 * Décrémente le stock promotionnel après une vente.
 *
 * Renvoie l'identifiant de la promotion consommée, ou `null` : l'appelant doit
 * pouvoir le journaliser, faute de quoi une annulation ne saura pas QUELLE
 * promotion restituer. C'est exactement le bug corrigé à l'étape 4 — le stock
 * promotionnel n'était jamais rendu.
 *
 * @returns {{ promotionId: string, quantity: number }|null}
 */
function consumePromoStock(productId, quantity = 1) {
  const promo = getActivePromotion(productId);
  if (!promo || promo.remaining_quantity == null) return null;

  const newRemaining = Math.max(0, promo.remaining_quantity - quantity);
  const consumed = promo.remaining_quantity - newRemaining;
  db.prepare('UPDATE promotions SET remaining_quantity = ? WHERE id = ?').run(newRemaining, promo.id);
  if (newRemaining <= 0) {
    db.prepare('UPDATE promotions SET active = 0 WHERE id = ?').run(promo.id);
  }
  return consumed > 0 ? { promotionId: promo.id, quantity: consumed } : null;
}

/**
 * Restitue le stock promotionnel d'une vente annulée.
 *
 * On cible la promotion PAR SON IDENTIFIANT, pas par « la promotion active du
 * produit » : entre la vente et l'annulation, la promotion a pu expirer, être
 * désactivée par épuisement, ou être remplacée par une autre. Restituer à la
 * promotion courante offrirait des unités promotionnelles à une opération qui n'a
 * rien vendu.
 *
 * Une promotion épuisée puis rendue redevient active : elle a de nouveau du stock.
 */
function restorePromoStock(promotionId, quantity = 1) {
  const promo = db.prepare('SELECT * FROM promotions WHERE id = ?').get(promotionId);
  if (!promo || promo.remaining_quantity == null) return null;

  const cap = promo.max_quantity ?? null;
  const restored = cap == null
    ? promo.remaining_quantity + quantity
    : Math.min(cap, promo.remaining_quantity + quantity);

  db.prepare('UPDATE promotions SET remaining_quantity = ? WHERE id = ?').run(restored, promotionId);

  // Réactivation seulement si la promotion n'est pas terminée par ailleurs : une
  // promotion expirée dans le temps ne doit pas repartir pour un tour.
  const expired = promo.ends_at && new Date(`${promo.ends_at}Z`).getTime() < Date.now();
  if (restored > 0 && !expired) {
    db.prepare('UPDATE promotions SET active = 1 WHERE id = ?').run(promotionId);
  }

  return db.prepare('SELECT * FROM promotions WHERE id = ?').get(promotionId);
}

/** Désactive les autres promotions sur le même produit */
function deactivateProductPromotions(productId, exceptId = null) {
  if (exceptId) {
    db.prepare('UPDATE promotions SET active = 0 WHERE product_id = ? AND id != ?').run(productId, exceptId);
  } else {
    db.prepare('UPDATE promotions SET active = 0 WHERE product_id = ?').run(productId);
  }
}

module.exports = {
  expirePromotions,
  getActivePromotion,
  enrichProductWithPromo,
  getEffectivePrice,
  consumePromoStock,
  restorePromoStock,
  deactivateProductPromotions,
  formatPromotion,
  formatFlashPromotion,
  getPromoStatus,
  getSoldCount,
};
