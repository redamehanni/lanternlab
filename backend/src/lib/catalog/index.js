/**
 * Organe Catalog — façade.
 *
 * Périmètre STRICT, et c'est le message principal de ce fichier : cet organe ne possède
 * que la DÉCLARATION d'un produit et sa MISE EN VENTE. Il ne possède pas encore tout
 * `products` — l'Épée écrit toujours par `routes/products.js`, et la réécrire n'était pas
 * le sujet de l'étape 6.
 *
 * Autrement dit, il y a aujourd'hui deux chemins d'écriture sur la même table. C'est une
 * dette, elle est connue, et elle est bornée : les deux chemins font des choses
 * différentes (l'un déclare en masse depuis une source, l'autre édite à la main), et aucun
 * n'écrit `products.quantity`, qui reste la propriété exclusive d'Inventory.
 */

const engine = require('./catalogEngine');
const { CatalogError } = require('./errors');

module.exports = {
  // Opérations
  declareProduct: engine.declareProduct,
  deactivateStoreProducts: engine.deactivateStoreProducts,
  reactivateProducts: engine.reactivateProducts,

  // Lectures
  getProduct: engine.getProduct,
  findByReference: engine.findByReference,
  listForStore: engine.listForStore,
  history: engine.history,

  // Vocabulaire
  ORIGIN: engine.ORIGIN,
  JOURNAL_TYPE: engine.JOURNAL_TYPE,
  CatalogError,
};
