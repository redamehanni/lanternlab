/**
 * World Factory — Purge du monde de démonstration par APPARTENANCE.
 *
 * Pourquoi : le reset historique ne supprimait que les entités tracées dans
 * `demo_entities`. Or, dès qu'on ENTRE dans le monde (impersonation) et qu'on
 * agit via les organes (passer une commande, émettre un objet…), des lignes
 * réelles apparaissent SANS être tracées. Elles doivent aussi disparaître au
 * reset, sinon le monde n'est jamais vraiment propre.
 *
 * Principe : on définit le monde démo comme l'ensemble des utilisateurs démo
 * (issus de `demo_entities`) + tout ce qui leur appartient. La purge supprime
 * cette clôture dans l'ordre des dépendances (enfants avant parents).
 *
 * Garde de sécurité : on ne supprime QUE des utilisateurs présents dans
 * `demo_entities`. Un vrai compte citoyen ne peut jamais être touché.
 */

const db = require('../../db');

function inClause(ids) {
  return ids.map(() => '?').join(',');
}

/** Restreint une liste d'ids aux seuls utilisateurs démo (sécurité). */
function keepDemoUsers(userIds) {
  if (!userIds.length) return [];
  const ph = inClause(userIds);
  return db
    .prepare(`SELECT DISTINCT entity_id FROM demo_entities WHERE entity_type = 'user' AND entity_id IN (${ph})`)
    .all(...userIds)
    .map((r) => r.entity_id);
}

/**
 * Supprime la clôture d'appartenance des utilisateurs démo fournis.
 * Renvoie le nombre d'utilisateurs purgés.
 */
function purgeUsers(userIds) {
  const users = keepDemoUsers([...new Set(userIds || [])]);
  if (users.length === 0) return { users: 0 };

  const run = db.transaction(() => {
    const uIn = inClause(users);

    // Boutiques des commerçants démo, puis produits de ces boutiques.
    const stores = db
      .prepare(`SELECT id FROM stores WHERE merchant_id IN (${uIn})`)
      .all(...users)
      .map((r) => r.id);
    const sIn = inClause(stores);
    const products = stores.length
      ? db.prepare(`SELECT id FROM products WHERE store_id IN (${sIn})`).all(...stores).map((r) => r.id)
      : [];
    const pIn = inClause(products);

    // Commandes rattachées au monde démo (client démo OU boutique/produit démo).
    const orderRows = db
      .prepare(`
        SELECT id FROM orders
        WHERE client_id IN (${uIn})
        ${stores.length ? `OR store_id IN (${sIn})` : ''}
        ${products.length ? `OR product_id IN (${pIn})` : ''}
      `)
      .all(...users, ...stores, ...products);
    const orders = orderRows.map((r) => r.id);
    const oIn = inClause(orders);

    // Conversations du monde démo (participants, boutique, ou commande).
    const convRows = db
      .prepare(`
        SELECT id FROM conversations
        WHERE user_a IN (${uIn}) OR user_b IN (${uIn})
        ${stores.length ? `OR store_id IN (${sIn})` : ''}
        ${orders.length ? `OR order_id IN (${oIn})` : ''}
      `)
      .all(...users, ...users, ...stores, ...orders);
    const convs = convRows.map((r) => r.id);
    const cIn = inClause(convs);

    // Objets Wallet des utilisateurs démo (+ journal append-only).
    const objRows = db.prepare(`SELECT id FROM digital_objects WHERE owner_id IN (${uIn})`).all(...users);
    const objs = objRows.map((r) => r.id);
    const objIn = inClause(objs);

    // Présentations d'identité (+ événements).
    const presRows = db.prepare(`SELECT id FROM identity_presentations WHERE user_id IN (${uIn})`).all(...users);
    const pres = presRows.map((r) => r.id);
    const presIn = inClause(pres);

    // Fils de support (+ messages).
    const supRows = db.prepare(`SELECT id FROM support_threads WHERE user_id IN (${uIn})`).all(...users);
    const sups = supRows.map((r) => r.id);
    const supIn = inClause(sups);

    const del = (sql, args) => db.prepare(sql).run(...args);

    // Wallet
    if (objs.length) {
      del(`DELETE FROM digital_object_events WHERE object_id IN (${objIn})`, objs);
      del(`DELETE FROM digital_objects WHERE id IN (${objIn})`, objs);
    }
    // Identity
    if (pres.length) del(`DELETE FROM identity_events WHERE presentation_id IN (${presIn})`, pres);
    del(`DELETE FROM identity_events WHERE subject_id IN (${uIn}) OR verifier_id IN (${uIn})`, [...users, ...users]);
    if (pres.length) del(`DELETE FROM identity_presentations WHERE id IN (${presIn})`, pres);
    // Support
    if (sups.length) del(`DELETE FROM support_messages WHERE thread_id IN (${supIn})`, sups);
    del(`DELETE FROM support_messages WHERE sender_id IN (${uIn})`, users);
    if (sups.length) del(`DELETE FROM support_threads WHERE id IN (${supIn})`, sups);
    // Communication
    if (convs.length) {
      del(`DELETE FROM conversation_reads WHERE conversation_id IN (${cIn})`, convs);
      del(`DELETE FROM messages WHERE conversation_id IN (${cIn})`, convs);
    }
    del(`DELETE FROM conversation_reads WHERE user_id IN (${uIn})`, users);
    if (orders.length) del(`DELETE FROM messages WHERE order_id IN (${oIn})`, orders);
    del(`DELETE FROM messages WHERE sender_id IN (${uIn})`, users);
    if (convs.length) del(`DELETE FROM conversations WHERE id IN (${cIn})`, convs);
    // Missions & commandes
    if (orders.length) del(`DELETE FROM missions WHERE order_id IN (${oIn})`, orders);
    del(`DELETE FROM missions WHERE driver_id IN (${uIn})`, users);
    if (orders.length) del(`DELETE FROM orders WHERE id IN (${oIn})`, orders);
    // Panier / favoris / promotions
    del(`DELETE FROM cart_items WHERE client_id IN (${uIn})`, users);
    if (products.length) del(`DELETE FROM cart_items WHERE product_id IN (${pIn})`, products);
    del(`DELETE FROM store_favorites WHERE client_id IN (${uIn})`, users);
    if (stores.length) del(`DELETE FROM store_favorites WHERE store_id IN (${sIn})`, stores);
    if (stores.length) del(`DELETE FROM promotions WHERE store_id IN (${sIn})`, stores);
    if (products.length) del(`DELETE FROM promotions WHERE product_id IN (${pIn})`, products);
    // Membres de boutique
    del(`DELETE FROM store_members WHERE user_id IN (${uIn})`, users);
    if (stores.length) del(`DELETE FROM store_members WHERE store_id IN (${sIn})`, stores);
    // Divers rattachés à l'utilisateur
    del(`DELETE FROM client_addresses WHERE client_id IN (${uIn})`, users);
    del(`DELETE FROM driver_notifications WHERE user_id IN (${uIn})`, users);
    del(`DELETE FROM merchant_notifications WHERE user_id IN (${uIn})`, users);
    // Catalogue puis boutiques puis utilisateurs
    if (products.length) del(`DELETE FROM products WHERE id IN (${pIn})`, products);
    if (stores.length) del(`DELETE FROM stores WHERE id IN (${sIn})`, stores);
    del(`DELETE FROM users WHERE id IN (${uIn})`, users);

    return users.length;
  });

  return { users: run() };
}

module.exports = { purgeUsers };
