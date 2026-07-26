/**
 * Integration Engine — déclarer un produit venu d'ailleurs.
 *
 * Ce fichier existe parce que l'étape 8 a révélé un privilège que l'étape 6 avait créé sans
 * le vouloir : la logique « une déclaration canonique devient un produit Ma Zone » vivait
 * dans `importer.js`, c'est-à-dire dans le chemin du CSV. Un connecteur d'éditeur aurait
 * donc eu deux options, toutes les deux mauvaises :
 *
 *   · appeler `importCatalog`, qui exige un document et le connecteur `manual` ;
 *   · réécrire la même boucle chez lui, et devenir le deuxième endroit du système qui sait
 *     déclarer un produit.
 *
 * La deuxième option est celle que l'on prend toujours sous la pression, et elle se paie
 * plus tard : le jour où déclarer un produit demandera un geste de plus, un connecteur
 * l'ignorera silencieusement. Le CSV et un éditeur du marché passent désormais par le même
 * chemin, et c'est la seule manière de garantir qu'ils se comportent pareil.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * CE FICHIER N'ÉCRIT RIEN. IL DEMANDE AUX ORGANES. (Loi 2)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * LIGNE PAR LIGNE, PAS TOUT OU RIEN. Quatre mille articles dont trois sont illisibles
 * doivent produire trois mille neuf cent quatre-vingt-dix-sept produits et trois lignes de
 * refus nommées. Le rejet global est ce qui fait abandonner un commerçant.
 */

const logger = require('../logger');
const orchestration = require('../orchestration');
const contract = require('./contract');
const bindings = require('./bindings');
const { IntegrationError } = require('./errors');

/** Résolu à l'appel : le Catalog ne doit pas être figé au chargement du module. */
const catalog = () => require('../catalog');

/**
 * Déclare un lot de produits canoniques.
 *
 * @param {object} params
 * @param {string} params.storeId
 * @param {object} params.connector       connecteur source, tel que le registre le donne
 * @param {object[]} params.items         produits canoniques (sortie de `toCanonical`)
 * @param {string|null} [params.actor]
 * @param {string} [params.actorRole]
 * @returns {{ created: number, updated: number, rejected: object[] }}
 */
function declareProducts({ storeId, connector, items = [], actor = null, actorRole = 'merchant' }) {
  if (!storeId) throw new IntegrationError('Boutique manquante.', 400);
  if (!connector?.id) throw new IntegrationError('Source de déclaration manquante.', 400);

  const results = { created: 0, updated: 0, rejected: [] };

  for (const canonical of items) {
    const externalId = canonical.externalId ?? canonical.reference;

    if (!externalId || !canonical.reference || !canonical.name) {
      results.rejected.push({
        externalId: externalId ?? null,
        line: canonical.line ?? null,
        reason: 'déclaration incomplète : référence ou nom manquant',
      });
      continue;
    }

    try {
      const outcome = declareOne({ storeId, connector, canonical, externalId, actor, actorRole });
      if (outcome.created) results.created += 1;
      else results.updated += 1;
    } catch (err) {
      results.rejected.push({
        externalId,
        line: canonical.line ?? null,
        reference: canonical.reference,
        reason: err.message,
      });
    }
  }

  logger.info('Catalogue déclaré depuis un logiciel', {
    storeId, connectorId: connector.id, items: items.length,
    created: results.created, updated: results.updated, rejected: results.rejected.length,
  });

  return results;
}

/**
 * Déclare un produit, par le chemin que sa situation impose.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * DEUX CHEMINS, ET C'EST L'ÉTAPE 8 QUI A RENDU LE SECOND NÉCESSAIRE
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * L'intention `catalog.declare_product` enchaîne deux organes : le Catalog crée l'identité,
 * l'Inventory pose le stock vendable. C'est le bon geste pour un produit qui n'existe pas
 * encore, et c'est ce que fait l'import CSV depuis l'étape 6.
 *
 * Confronté à un vrai éditeur, ce geste heurte une règle de l'organe Inventory, et cette
 * règle a raison : sur une ligne en mode `pos`, `declareSellable` est REFUSÉ, parce que le
 * stock physique appartient au logiciel du commerçant et que Ma Zone n'en est que le miroir
 * (étape 4). Une mise à jour de fiche produit venue de l'éditeur — un nom corrigé, un prix
 * changé — échouerait donc entièrement, faute d'avoir le droit de réécrire un stock qu'elle
 * ne cherchait pas à toucher.
 *
 * Trois solutions étaient possibles. Deux étaient mauvaises :
 *
 *   ✗ assouplir `declareSellable` pour tolérer le mode `pos` — c'est démonter la matrice de
 *     propriété pour la commodité d'un connecteur, exactement l'inversion que Ma Zone refuse ;
 *   ✗ ajouter une intention `catalog.declare_external_product` — c'est faire évoluer le cœur
 *     pour accueillir un éditeur, et le critère de réussite de l'étape 8 est qu'aucun organe
 *     ne bouge.
 *
 * La troisième est celle-ci : reconnaître qu'une mise à jour d'identité sur un produit DÉJÀ
 * connu, dont le stock est fourni par le logiciel lui-même, est une opération MONO-ORGANE.
 * Elle parle donc à son organe directement — ce que la Loi 5 prévoit, et ce que `sync.js`
 * fait déjà pour `syncOnHand`. Le stock, lui, arrive par le chemin du stock.
 *
 * LA CONDITION EST EXPRIMÉE EN CAPACITÉS, PAS EN ÉDITEURS NI EN MODE DE STOCK. « Ce logiciel
 * sait fournir son stock » (`pull_inventory`) est du vocabulaire de contrat, valable pour la
 * caisse suivante comme pour celle-ci. Interroger `inventory_owner` ici aurait rejoué chez
 * nous un arbitrage qui appartient à l'organe — et créé une deuxième vérité sur la question.
 */
function declareOne({ storeId, connector, canonical, externalId, actor, actorRole }) {
  const known = bindings.resolve({
    connectorId: connector.id,
    externalId,
    entityType: bindings.ENTITY_TYPE.PRODUCT,
    externalLocationId: canonical.externalLocationId ?? null,
  });

  const sourceProvidesStock = contract.supports(connector, 'pull_inventory');

  if (known && sourceProvidesStock) {
    const declared = catalog().declareProduct({
      storeId,
      reference: canonical.reference,
      name: canonical.name,
      price: canonical.price ?? null,
      category: canonical.category ?? null,
      description: canonical.description ?? null,
      origin: catalog().ORIGIN.CONNECTOR,
      actor,
    });

    touch({ connector, canonical, externalId, mazoneId: declared.product.id });
    return { created: !!declared.created };
  }

  const run = orchestration.run('catalog.declare_product', {
    storeId,
    reference: canonical.reference,
    name: canonical.name,
    quantity: canonical.quantity,
    price: canonical.price ?? undefined,
    category: canonical.category ?? undefined,
    description: canonical.description ?? undefined,
  }, {
    actor,
    // `merchant` et non `system` : c'est bien un commerçant qui déclare son catalogue, le
    // fichier ou l'éditeur n'est que le moyen. L'auteur d'une décision n'est jamais l'outil
    // qui l'a transportée.
    actorRole,
    // Une clé par connecteur, boutique, entité externe et quantité : relire deux fois la
    // même page ne recrée rien, et deux lectures concurrentes ne se doublonnent pas.
    idempotencyKey: `declare:${connector.id}:${storeId}:${externalId}:${canonical.quantity}`,
  });

  const declared = run.results['catalog.declareProduct'];
  touch({ connector, canonical, externalId, mazoneId: declared.product.id });

  return { created: !!declared?.created };
}

/**
 * Enregistre ou rafraîchit la correspondance externe.
 *
 * C'est ce qui rend la SUITE possible : sans elle, la prochaine déclaration de stock de ce
 * produit serait refusée en `unmapped_entity`, et le commerçant verrait un conflit pour un
 * produit qu'il vient d'importer.
 */
function touch({ connector, canonical, externalId, mazoneId }) {
  bindings.bind({
    entityType: bindings.ENTITY_TYPE.PRODUCT,
    mazoneId,
    connectorId: connector.id,
    externalId,
    externalLocationId: canonical.externalLocationId ?? null,
    sourceUpdatedAt: canonical.sourceUpdatedAt ?? null,
  });
}

module.exports = { declareProducts };
