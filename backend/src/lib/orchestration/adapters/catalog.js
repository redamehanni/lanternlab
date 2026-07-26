/**
 * Orchestration — adaptateur de l'organe Catalog.
 *
 * Ce fichier portait du SQL en attendant que l'organe existe. L'étape 6 a créé
 * `lib/catalog/`, et il est redevenu ce qu'un adaptateur doit être : une délégation.
 *
 * Un adaptateur qui grossit est un organe qui manque. Celui-ci a rétréci, ce qui est le
 * signe inverse et le bon.
 */

/** Résolu à l'appel, comme les autres organes : l'ordre de chargement ne doit pas compter. */
const catalog = () => require('../../catalog');

module.exports = {
  /**
   * Retire de la vente tous les produits d'une boutique.
   *
   * Renvoie la liste des produits effectivement désactivés : c'est elle, et non « tous
   * les produits de la boutique », que la compensation réactive.
   */
  deactivateStoreProducts: (params, ctx) => catalog().deactivateStoreProducts({
    storeId: params.storeId,
    actor: ctx.actor,
  }),

  /** Compensation : remet en vente exactement ce que l'étape précédente a retiré. */
  reactivateProducts: (params, ctx) => catalog().reactivateProducts({
    productIds: ctx.results['catalog.deactivateStoreProducts']?.deactivated || [],
    actor: ctx.actor,
  }),

  /**
   * Déclare un produit depuis une source de masse (fichier, logiciel du commerçant).
   *
   * L'origine est transmise telle quelle : l'organe doit pouvoir dire plus tard qui a
   * écrit une ligne de catalogue, et un import n'est pas une saisie.
   */
  declareProduct: (params, ctx) => catalog().declareProduct({
    storeId: params.storeId,
    reference: params.reference,
    name: params.name,
    price: params.price,
    category: params.category,
    description: params.description,
    origin: params.origin,
    actor: ctx.actor,
  }),
};
