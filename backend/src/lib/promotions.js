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

/** Décrémente le stock promotionnel après une vente */
function consumePromoStock(productId, quantity = 1) {
  const promo = getActivePromotion(productId);
  if (!promo || promo.remaining_quantity == null) return promo;

  const newRemaining = Math.max(0, promo.remaining_quantity - quantity);
  db.prepare('UPDATE promotions SET remaining_quantity = ? WHERE id = ?').run(newRemaining, promo.id);
  if (newRemaining <= 0) {
    db.prepare('UPDATE promotions SET active = 0 WHERE id = ?').run(promo.id);
  }
  return getActivePromotion(productId);
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
  deactivateProductPromotions,
  formatPromotion,
  formatFlashPromotion,
  getPromoStatus,
  getSoldCount,
};
