/**
 * World Factory — Contexte de création d'un batch.
 *
 * Fournit aux recettes des primitives qui (1) créent l'entité et (2) tracent
 * systématiquement sa provenance dans `demo_entities`, pour un reset propre.
 *
 * RAPPEL (principe fondamental) : orchestrer, jamais réimplémenter.
 *  - Donnée d'un organe (ex. objet Wallet) → on appelle l'organe (walletEngine).
 *  - Entités de base sans organe dédié (users/stores/products) → créées ici de
 *    façon minimale, en attendant qu'elles deviennent de vrais organes
 *    (Catalog/Orders) ; ces primitives délégueront alors à eux, sans changer les
 *    recettes.
 *
 * Aucune règle métier ne doit vivre ici : uniquement de la création + du tag.
 */

const bcrypt = require('bcrypt');
const db = require('../../db');
const wallet = require('../walletEngine');
const events = require('../eventEngine');

const ENTITY = {
  USER: 'user',
  STORE: 'store',
  PRODUCT: 'product',
  FAVORITE: 'favorite',
  WALLET_OBJECT: 'wallet_object',
  EVENT: 'event',
};

function createContext(batchId) {
  const counts = {};

  function bump(type) {
    counts[type] = (counts[type] || 0) + 1;
  }

  function track(entityType, entityId) {
    db.prepare(
      'INSERT INTO demo_entities (id, batch_id, entity_type, entity_id) VALUES (?, ?, ?, ?)'
    ).run(db.generateId(), batchId, entityType, entityId);
    bump(entityType);
  }

  function insertUser({ name, email, role, password = 'demo1234', phone = null, address = null, lat = null, lng = null, transport = null }) {
    const id = db.generateId();
    const hash = bcrypt.hashSync(password, 10);
    db.prepare(
      `INSERT INTO users (id, name, email, password, phone, role, address, lat, lng, transport)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(id, name, email, hash, phone, role, address, lat, lng, transport);
    track(ENTITY.USER, id);
    return db.prepare('SELECT id, name, email, role, lat, lng, transport FROM users WHERE id = ?').get(id);
  }

  // ── Primitives exposées aux recettes ────────────────────────────────────────

  function createCitizen(attrs = {}) {
    return insertUser({ ...attrs, role: 'client' });
  }

  function createMerchant(attrs = {}) {
    return insertUser({ ...attrs, role: 'merchant' });
  }

  // Livreur : acteur du monde comme un autre (aucune mission/dispatch ici).
  function createDriver(attrs = {}) {
    return insertUser({ ...attrs, role: 'driver' });
  }

  function createStore(merchantId, attrs = {}) {
    const id = db.generateId();
    db.prepare(
      `INSERT INTO stores (id, merchant_id, name, address, description, phone, email, lat, lng, category, story, photo_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id, merchantId,
      attrs.name || 'Commerce', attrs.address || null, attrs.description || null,
      attrs.phone || null, attrs.email || null,
      attrs.lat ?? null, attrs.lng ?? null,
      attrs.category || null, attrs.story || null, attrs.photo_url || null
    );
    // Cohérence avec le modèle multi-employés (le propriétaire est membre).
    db.prepare(
      "INSERT OR IGNORE INTO store_members (store_id, user_id, member_role) VALUES (?, ?, 'owner')"
    ).run(id, merchantId);
    track(ENTITY.STORE, id);
    return db.prepare('SELECT * FROM stores WHERE id = ?').get(id);
  }

  function createMerchantWithStore(merchantAttrs = {}, storeAttrs = {}) {
    const merchant = createMerchant(merchantAttrs);
    const store = createStore(merchant.id, storeAttrs);
    return { merchant, store };
  }

  function createProduct(storeId, attrs = {}) {
    const id = db.generateId();
    db.prepare(
      `INSERT INTO products (id, store_id, name, description, price, quantity, category, image_url, barcode)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id, storeId,
      attrs.name || 'Produit', attrs.description || null,
      Number(attrs.price) || 0, Number.isFinite(attrs.quantity) ? attrs.quantity : 0,
      attrs.category || null, attrs.image_url || null, attrs.barcode || null
    );
    track(ENTITY.PRODUCT, id);
    return db.prepare('SELECT * FROM products WHERE id = ?').get(id);
  }

  function addFavorite(clientId, storeId) {
    const id = db.generateId();
    db.prepare(
      'INSERT OR IGNORE INTO store_favorites (id, client_id, store_id) VALUES (?, ?, ?)'
    ).run(id, clientId, storeId);
    track(ENTITY.FAVORITE, id);
    return id;
  }

  /**
   * Émet un objet Wallet EN PASSANT PAR L'ORGANE (jamais d'insert direct).
   * Illustre le principe : orchestrer, ne pas réimplémenter.
   */
  function issueWalletObject(params = {}) {
    const obj = wallet.issueObject({ ...params, sourceEngine: 'world_factory' });
    track(ENTITY.WALLET_OBJECT, obj.id);
    return obj;
  }

  /**
   * Consomme un objet Wallet via l'organe (ex. billet → souvenir).
   * N'ajoute pas d'entité : l'objet est déjà tracé à l'émission.
   */
  function consumeWalletObject({ objectId, idempotencyKey = null } = {}) {
    return wallet.consumeObject({
      objectId,
      consumerEngine: 'world_factory',
      idempotencyKey,
    });
  }

  /**
   * Crée une INITIATIVE LOCALE EN PASSANT PAR L'ORGANE Event Engine (jamais
   * d'insert direct). Illustre le principe : orchestrer, ne pas réimplémenter.
   * Optionnellement la publie (une initiative naît en brouillon par défaut).
   */
  function createEventInitiative(params = {}, { publish = false } = {}) {
    const event = events.createEvent(params);
    track(ENTITY.EVENT, event.id);
    if (publish) return events.publishEvent(event.id, { actor: params.sourceId || 'world_factory' });
    return event;
  }

  /**
   * Transitionne une initiative démo via l'organe (jamais d'UPDATE direct).
   * Utile pour rendre découvrables des types au cycle de vie spécialisé (ex.
   * Lanterne : hidden → active), que `publish` ne couvre pas.
   */
  function transitionEventInitiative(eventId, toStatus) {
    return events.transitionEvent(eventId, toStatus, { actor: 'world_factory' });
  }

  /**
   * Définit le Mode Réception d'un habitant démo (canaux d'écoute) via l'organe.
   * Permet aux Opportunités Volantes d'avoir une audience dans le monde de démo.
   */
  function setModeReception(userId, subscriptions = []) {
    return events.setModeReception(userId, subscriptions);
  }

  return {
    batchId,
    // primitives
    createCitizen,
    createMerchant,
    createDriver,
    createStore,
    createMerchantWithStore,
    createProduct,
    addFavorite,
    issueWalletObject,
    consumeWalletObject,
    createEventInitiative,
    transitionEventInitiative,
    setModeReception,
    track,
    // introspection
    counts: () => ({ ...counts }),
  };
}

module.exports = { createContext, ENTITY };
