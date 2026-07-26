/**
 * Integration Engine — import et export manuels.
 *
 * Le chemin d'adoption A : un commerçant arrive avec un tableur et vend le même jour.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * CE FICHIER N'ÉCRIT RIEN. IL FORMULE DES INTENTIONS.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Chaque ligne du fichier devient une déclaration canonique, confiée à `declare.js` — le
 * chemin commun à TOUS les connecteurs depuis l'étape 8 — qui la fait exécuter par les
 * organes. Un `INSERT INTO products` ici aurait été plus court d'une centaine de lignes, et
 * aurait coûté trois choses qu'on ne récupère pas :
 *
 *   · la règle de création du catalogue aurait vécu à deux endroits ;
 *   · l'import n'aurait pas été journalisé comme le reste des décisions (Loi 9) ;
 *   · le jour où déclarer un produit devra faire un geste de plus, l'import serait le
 *     seul chemin à l'ignorer — et personne ne s'en apercevrait avant longtemps.
 *
 * LIGNE PAR LIGNE, PAS TOUT OU RIEN. Un fichier de cinq cents articles dont trois sont
 * illisibles doit importer quatre cent quatre-vingt-dix-sept articles et dire lesquels
 * ont été refusés. Le rejet global est le comportement qui décourage un commerçant :
 * il ne sait pas quoi corriger, alors il abandonne.
 */

const logger = require('../logger');
const registry = require('./connectorRegistry');
const installations = require('./installations');
const declare = require('./declare');
const outbox = require('./outbox');
const csv = require('./connectors/csv');
const { IntegrationError } = require('./errors');

const CONNECTOR_ID = 'manual';

/** Le connecteur manuel, avec son extension `inspect` hors contrat. */
const manual = () => require('./connectors/manual');

/**
 * Examine un fichier sans rien importer.
 *
 * Existe pour une raison d'usage, pas de technique : un commerçant doit pouvoir voir ce
 * que Ma Zone a compris de son fichier — colonnes reconnues, nombre de lignes — avant de
 * valider. Un import qui part directement est un import qu'on n'ose pas essayer.
 */
function inspect(document) {
  return manual().inspect(document);
}

/**
 * Importe un catalogue.
 *
 * @param {object} params
 * @param {string} params.storeId
 * @param {string} params.document  contenu CSV
 * @param {string} params.actor     identifiant du commerçant
 * @returns {{ imported: number, created: number, updated: number, rejected: object[] }}
 */
function importCatalog({ storeId, document, actor = null }) {
  if (!storeId) throw new IntegrationError('Boutique manquante.', 400);
  if (typeof document !== 'string' || document.trim() === '') {
    throw new IntegrationError('Fichier vide.', 400);
  }

  const installation = installations.find(storeId, CONNECTOR_ID);
  if (!installation || installation.status !== installations.STATUS.ACTIVE) {
    throw new IntegrationError(
      'Le connecteur « Saisie et fichiers » n\'est pas activé sur cette boutique.',
      409
    );
  }

  const check = inspect(document);
  if (!check.usable) {
    throw new IntegrationError(
      `Il manque à ce fichier ${check.missing.join(', ')}.`,
      422
    );
  }

  const connector = registry.get(CONNECTOR_ID);
  const { items, rejected = [] } = connector.pull('product', null, { document });

  // ÉTAPE 8 — la boucle de déclaration a quitté ce fichier pour `declare.js`, et ce
  // déplacement est le vrai livrable du chantier « famille de connecteurs ». Elle vivait
  // ici, donc dans le chemin du CSV : un connecteur d'éditeur aurait dû soit passer par un
  // import de fichier qui n'existe pas chez lui, soit réécrire la même boucle. Ce fichier
  // garde ce qui lui appartient vraiment — vérifier un document, compter des lignes, dire
  // ce qui a été refusé —, le reste est commun à tous les logiciels.
  const results = declare.declareProducts({
    storeId,
    connector,
    items: items.map((item) => ({ ...connector.toCanonical('product', item), line: item.line })),
    actor,
  });

  const failures = [...rejected, ...results.rejected];

  logger.info('Import de catalogue', {
    storeId, lines: items.length,
    created: results.created, updated: results.updated, rejected: failures.length,
  });

  return {
    imported: results.created + results.updated,
    created: results.created,
    updated: results.updated,
    rejected: failures,
    lineCount: check.lineCount,
  };
}

/**
 * Exporte les ventes destinées au logiciel du commerçant.
 *
 * L'OUTBOX EST LE REGISTRE D'EXPORT, et ce n'est pas un détournement. Le connecteur
 * manuel « livre » une vente en la rendant exportable : sa destination est un humain qui
 * la recopiera dans sa caisse. Tenir une seconde table d'export ferait deux vérités sur
 * la même question — qu'est-ce qui est parti, qu'est-ce qui reste à passer.
 */
function exportSales({ storeId, includeSent = true }) {
  const messages = outbox
    .forStore(storeId, { limit: 1000 })
    .filter((m) => m.connector_id === CONNECTOR_ID && m.resource === 'order')
    .filter((m) => includeSent || m.status !== outbox.STATUS.SENT);

  const connector = registry.get(CONNECTOR_ID);
  const rows = messages.map((message) => ({
    ...connector.fromCanonical('order', message.payload),
    etat: message.status,
  }));

  return {
    rows,
    csv: csv.serialize(rows, [
      'date', 'commande', 'produit', 'reference', 'quantite', 'montant', 'operation', 'etat',
    ]),
  };
}

module.exports = { CONNECTOR_ID, inspect, importCatalog, exportSales };
