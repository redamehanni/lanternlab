/**
 * World Factory — Explorateur du monde de démonstration (LECTURE SEULE).
 *
 * Le Laboratoire observe le monde généré : ses acteurs et ce qui gravite autour
 * d'eux (boutique, produits, commandes, objets Wallet, identités, favoris).
 *
 * PRINCIPE : uniquement des SELECT. L'explorateur ne modifie jamais rien. Toute
 * mutation passe par les organes (impersonation / actions de labo), jamais ici.
 *
 * Périmètre : STRICTEMENT les acteurs démo (présents dans `demo_entities`). Les
 * vrais comptes citoyens ne sont jamais exposés par le Laboratoire.
 */

const db = require('../../db');

/** Ids des utilisateurs démo (optionnellement restreints à un batch). */
function demoUserIds(batchId = null) {
  const rows = batchId
    ? db.prepare("SELECT entity_id FROM demo_entities WHERE entity_type = 'user' AND batch_id = ?").all(batchId)
    : db.prepare("SELECT entity_id FROM demo_entities WHERE entity_type = 'user'").all();
  return rows.map((r) => r.entity_id);
}

/** Un utilisateur est-il un acteur démo ? (garde pour impersonation / actions) */
function isDemoUser(userId) {
  const row = db
    .prepare("SELECT 1 FROM demo_entities WHERE entity_type = 'user' AND entity_id = ? LIMIT 1")
    .get(userId);
  return !!row;
}

/** Liste des acteurs démo, filtrable par rôle et par batch. */
function listActors({ type = null, batchId = null } = {}) {
  const ids = demoUserIds(batchId);
  if (ids.length === 0) return [];

  const placeholders = ids.map(() => '?').join(',');
  let sql = `
    SELECT u.id, u.name, u.email, u.role, u.lat, u.lng, u.photo_url, u.created_at
    FROM users u
    WHERE u.id IN (${placeholders})
  `;
  const args = [...ids];
  if (type) {
    sql += ' AND u.role = ?';
    args.push(type);
  }
  sql += ' ORDER BY u.role, u.name';

  const actors = db.prepare(sql).all(...args);

  // Comptes légers par rôle pour l'aperçu (toujours en lecture seule).
  return actors.map((a) => ({
    ...a,
    counts: quickCounts(a),
  }));
}

function quickCounts(actor) {
  const walletCount = db
    .prepare('SELECT COUNT(*) c FROM digital_objects WHERE owner_id = ?')
    .get(actor.id).c;

  if (actor.role === 'client') {
    return {
      wallet: walletCount,
      orders: db.prepare('SELECT COUNT(*) c FROM orders WHERE client_id = ?').get(actor.id).c,
      favorites: db.prepare('SELECT COUNT(*) c FROM store_favorites WHERE client_id = ?').get(actor.id).c,
    };
  }
  if (actor.role === 'merchant') {
    const store = db.prepare('SELECT id FROM stores WHERE merchant_id = ?').get(actor.id);
    return {
      wallet: walletCount,
      stores: db.prepare('SELECT COUNT(*) c FROM stores WHERE merchant_id = ?').get(actor.id).c,
      products: store
        ? db.prepare('SELECT COUNT(*) c FROM products WHERE store_id = ?').get(store.id).c
        : 0,
    };
  }
  if (actor.role === 'driver') {
    return {
      wallet: walletCount,
      missions: db.prepare('SELECT COUNT(*) c FROM missions WHERE driver_id = ?').get(actor.id).c,
    };
  }
  return { wallet: walletCount };
}

/** Détail complet d'un acteur démo (profil + gravitation), lecture seule. */
function getActorDetail(userId) {
  const user = db
    .prepare('SELECT id, name, email, role, phone, address, lat, lng, photo_url, created_at FROM users WHERE id = ?')
    .get(userId);
  if (!user) return null;

  const detail = {
    ...user,
    isDemo: isDemoUser(userId),
    wallet: db
      .prepare('SELECT id, kind, family, status, display, created_at FROM digital_objects WHERE owner_id = ? ORDER BY updated_at DESC')
      .all(userId)
      .map((o) => ({ ...o, display: safeParse(o.display) })),
    identity: db
      .prepare('SELECT id, purpose, status, expires_at, created_at FROM identity_presentations WHERE user_id = ? ORDER BY created_at DESC')
      .all(userId),
  };

  if (user.role === 'client') {
    detail.orders = db
      .prepare('SELECT id, product_id, store_id, status, total_price, created_at FROM orders WHERE client_id = ? ORDER BY created_at DESC')
      .all(userId);
    detail.favorites = db
      .prepare(`SELECT s.id, s.name, s.category FROM store_favorites f
                JOIN stores s ON s.id = f.store_id WHERE f.client_id = ?`)
      .all(userId);
  }

  if (user.role === 'merchant') {
    const stores = db.prepare('SELECT * FROM stores WHERE merchant_id = ?').all(userId);
    detail.stores = stores.map((s) => ({
      ...s,
      products: db.prepare('SELECT id, name, price, quantity, category FROM products WHERE store_id = ?').all(s.id),
      orders: db.prepare('SELECT id, client_id, status, total_price, created_at FROM orders WHERE store_id = ? ORDER BY created_at DESC').all(s.id),
    }));
  }

  if (user.role === 'driver') {
    detail.missions = db
      .prepare(`SELECT m.id, m.order_id, m.status, m.created_at FROM missions m
                WHERE m.driver_id = ? ORDER BY m.created_at DESC`)
      .all(userId);
  }

  return detail;
}

function safeParse(json) {
  if (!json) return null;
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}

module.exports = { listActors, getActorDetail, isDemoUser, demoUserIds };
