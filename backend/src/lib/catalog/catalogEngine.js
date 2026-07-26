/**
 * Organe Catalog — le moteur.
 *
 * ORGANE CRÉÉ À L'ÉTAPE 6, ET IL FAUT DIRE POURQUOI ICI PLUTÔT QU'AILLEURS.
 *
 * La roadmap ne prévoyait pas d'organe Catalog. L'étape 6 l'a rendu nécessaire pour une
 * raison qu'on n'avait pas vue : importer un catalogue depuis un fichier, c'est CRÉER des
 * produits. Or un connecteur ne crée jamais une entité métier (Loi 2), et le moteur
 * d'intégration non plus. Sans organe pour recevoir la déclaration, il ne restait que
 * deux issues, et les deux étaient mauvaises :
 *
 *   · un `INSERT INTO products` dans le moteur d'intégration — la règle de création du
 *     catalogue aurait alors vécu à deux endroits, dont un que personne ne penserait à
 *     ouvrir le jour où elle change ;
 *   · renoncer à l'import — c'est-à-dire renoncer au seul geste qui fait entrer un
 *     commerçant dans Ma Zone en dix minutes.
 *
 * Cet organe est donc VOLONTAIREMENT MINUSCULE : il fait ce que l'étape 6 exige, rien de
 * plus. Il ne gère pas les variantes, ni les photos, ni les catégories structurées, ni la
 * traduction. `routes/products.js` continue de servir l'Épée sans une ligne modifiée. Un
 * organe qu'on découvre en cours de route mérite d'être petit : on ne connaît pas encore
 * la forme de ce qu'il deviendra.
 *
 * LOI 11 — il n'écrit JAMAIS `products.quantity`. Cette colonne est la projection de
 * `available`, propriété du seul organe Inventory depuis l'étape 4. Un produit créé ici
 * naît donc à zéro, et c'est Inventory qui lui donne son stock — par une autre étape de
 * la même intention.
 */

const db = require('../../db');
const { txn, journal } = require('../kernel');
const { CatalogError } = require('./errors');

const catalogJournal = journal.defineJournal({
  name: 'catalog',
  table: 'catalog_journal',
  subjectColumn: 'product_id',
  subjectReferences: 'products(id)',
});

const JOURNAL_TYPE = {
  DECLARED: 'declared',
  UPDATED: 'updated',
  ACTIVATED: 'activated',
  DEACTIVATED: 'deactivated',
};

/** Origines d'une déclaration. Tracée pour répondre plus tard à « qui a écrit ceci ». */
const ORIGIN = {
  MERCHANT: 'merchant',
  CONNECTOR: 'connector',
};

/**
 * Déclare un produit : le crée s'il n'existe pas, met à jour son contenu sinon.
 *
 * L'appariement se fait sur la RÉFÉRENCE dans la boutique (`barcode`), jamais sur le nom.
 * Un nom se retape, se corrige, s'accorde différemment ; deux produits d'une même
 * boutique peuvent légitimement s'appeler pareil. Apparier sur le nom fusionnerait deux
 * articles distincts et rendrait leurs deux stocks faux.
 *
 * Idempotent par construction : réimporter le même fichier ne duplique rien.
 */
function declareProduct({
  storeId, reference, name, price = null, category = null, description = null,
  origin = ORIGIN.MERCHANT, actor = null,
}) {
  if (!storeId) throw new CatalogError('Boutique manquante.', 400);
  if (!reference) {
    throw new CatalogError(
      'Un produit déclaré doit porter une référence : c\'est elle qui permet de le '
      + 'retrouver au prochain import au lieu de le créer une seconde fois.',
      400
    );
  }
  if (!name || String(name).trim() === '') throw new CatalogError('Nom de produit manquant.', 400);

  const reference_ = String(reference).trim();

  return txn.run((ctx) => {
    const store = db.prepare('SELECT id FROM stores WHERE id = ?').get(storeId);
    if (!store) throw new CatalogError('Boutique introuvable.', 404);

    const existing = db
      .prepare('SELECT * FROM products WHERE store_id = ? AND barcode = ?')
      .get(storeId, reference_);

    if (existing) {
      // Le prix n'est écrasé que s'il est déclaré. Une colonne prix absente du fichier
      // ne veut pas dire « gratuit » : elle veut dire « je ne parle pas du prix ».
      db.prepare(`
        UPDATE products
        SET name = ?, price = COALESCE(?, price),
            category = COALESCE(?, category), description = COALESCE(?, description)
        WHERE id = ?
      `).run(String(name).trim(), price, category, description, existing.id);

      const updated = getProduct(existing.id);
      catalogJournal.append(existing.id, {
        type: JOURNAL_TYPE.UPDATED,
        actor,
        payload: { origin, reference: reference_, name: updated.name, price: updated.price },
      });

      ctx.publish('catalog.declared', {
        productId: existing.id, storeId, created: false, origin,
      });

      return { product: updated, created: false };
    }

    const id = db.generateId();
    // `quantity` est volontairement absent de l'insertion : sa valeur par défaut est 0 et
    // seul l'organe Inventory a le droit de l'écrire (Loi 11).
    db.prepare(`
      INSERT INTO products (id, store_id, name, description, price, category, barcode, active)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1)
    `).run(id, storeId, String(name).trim(), description, price ?? 0, category, reference_);

    const created = getProduct(id);
    catalogJournal.append(id, {
      type: JOURNAL_TYPE.DECLARED,
      actor,
      payload: { origin, reference: reference_, name: created.name, price: created.price },
    });

    ctx.publish('catalog.declared', { productId: id, storeId, created: true, origin });

    return { product: created, created: true };
  });
}

/**
 * Retire de la vente tous les produits d'une boutique, et renvoie ceux qui l'ont été.
 *
 * Reprise de `orchestration/adapters/catalog.js`, où ce SQL vivait en attendant cet
 * organe. La liste retournée est ce qui rend la compensation exacte : réactiver « tous
 * les produits de la boutique » remettrait en vente ceux que le commerçant avait
 * volontairement retirés avant sa fermeture.
 */
function deactivateStoreProducts({ storeId, actor = null }) {
  return txn.run((ctx) => {
    const ids = db
      .prepare('SELECT id FROM products WHERE store_id = ? AND active = 1')
      .all(storeId)
      .map((r) => r.id);

    for (const id of ids) {
      db.prepare('UPDATE products SET active = 0 WHERE id = ?').run(id);
      catalogJournal.append(id, { type: JOURNAL_TYPE.DEACTIVATED, actor, payload: { storeId } });
    }

    if (ids.length) ctx.publish('catalog.deactivated', { storeId, productIds: ids });

    return { deactivated: ids };
  });
}

/** Remet en vente exactement les produits fournis. */
function reactivateProducts({ productIds = [], actor = null }) {
  return txn.run((ctx) => {
    for (const id of productIds) {
      db.prepare('UPDATE products SET active = 1 WHERE id = ?').run(id);
      catalogJournal.append(id, { type: JOURNAL_TYPE.ACTIVATED, actor, payload: null });
    }

    if (productIds.length) ctx.publish('catalog.activated', { productIds });

    return { reactivated: productIds };
  });
}

function getProduct(id) {
  return db.prepare('SELECT * FROM products WHERE id = ?').get(id) || null;
}

/**
 * Produits d'une boutique.
 *
 * AJOUTÉ À L'ÉTAPE 7, et il faut dire pourquoi cette lecture arrive ici plutôt que dans
 * la route qui en a besoin. `/api/v1` doit lister le catalogue d'une boutique. Écrire ce
 * `SELECT` dans la route aurait donné deux endroits qui savent ce qu'est « un produit
 * visible » — celui-ci et `routes/products.js` — et le jour où la définition change
 * (déclinaisons, dates de mise en vente, visibilité par canal), l'un des deux serait
 * oublié. Lire le catalogue est un acte du catalogue.
 *
 * `activeOnly` par défaut à vrai : une surface publique ne montre pas ce qui a été retiré
 * de la vente. Le commerçant, lui, doit voir ses produits inactifs pour les remettre.
 */
function listForStore(storeId, { activeOnly = true, limit = 200 } = {}) {
  const rows = activeOnly
    ? db.prepare(`
        SELECT * FROM products WHERE store_id = ? AND active = 1
        ORDER BY created_at DESC LIMIT ?
      `).all(storeId, limit)
    : db.prepare(`
        SELECT * FROM products WHERE store_id = ?
        ORDER BY created_at DESC LIMIT ?
      `).all(storeId, limit);

  return rows;
}

/** Produit d'une boutique portant cette référence, ou `null`. */
function findByReference(storeId, reference) {
  return db
    .prepare('SELECT * FROM products WHERE store_id = ? AND barcode = ?')
    .get(storeId, String(reference).trim()) || null;
}

/** Biographie d'un produit. */
function history(productId) {
  return catalogJournal.read(productId);
}

module.exports = {
  JOURNAL_TYPE,
  ORIGIN,
  declareProduct,
  deactivateStoreProducts,
  reactivateProducts,
  getProduct,
  findByReference,
  listForStore,
  history,
};
