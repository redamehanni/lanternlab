/**
 * Integration Engine — aller chercher, et réconcilier.
 *
 * L'étape 6 savait RECEVOIR (webhook, fichier déposé). Ce fichier sait ALLER CHERCHER, et
 * les deux ne sont pas redondants : un webhook se perd. Il se perd parce que l'éditeur a eu
 * une panne, parce que notre serveur redémarrait, parce qu'un abonnement a expiré, ou
 * parce que quelqu'un a modifié le stock pendant que l'intégration était en pause.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * LA RÉCONCILIATION EST CE QUI REND UNE INTÉGRATION HONNÊTE
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Sans elle, un stock divergent le reste indéfiniment, et personne ne le sait — ni le
 * commerçant, ni Ma Zone. Avec elle, la divergence a une durée de vie maximale connue, et
 * c'est cette borne qu'on peut promettre à un commerçant.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * CE FICHIER NE DÉCIDE RIEN, ET LA TENTATION ÉTAIT PRÉCISE
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Comparer un stock lu chez l'éditeur au stock Ma Zone, puis écrire la différence, aurait
 * fait gagner un détour par l'Inbox. Cela aurait aussi créé un DEUXIÈME chemin d'écriture
 * du stock externe, avec ses propres règles de fraîcheur, ses propres conflits, et son
 * propre comportement en mode `pos`. Deux chemins qui prétendent appliquer la même règle
 * finissent toujours par ne plus l'appliquer pareil.
 *
 * Donc : ce fichier LIT chez l'éditeur et ENFILE dans l'Inbox. Le traitement reste celui de
 * `sync.ingest` — même traduction, même fraîcheur, même arbitrage de propriété, mêmes
 * conflits. Une réconciliation n'est rien d'autre qu'une relecture délibérée.
 *
 * LOI 16 — aucun éditeur, aucun protocole, aucun format ici : `connector.pull` fait le
 * dialecte, ce fichier fait la boucle, le curseur et la file.
 */

const logger = require('../logger');
const registry = require('./connectorRegistry');
const contract = require('./contract');
const installations = require('./installations');
const cursors = require('./cursors');
const inbox = require('./inbox');
const declare = require('./declare');
const context = require('./context');
const { IntegrationError } = require('./errors');

/**
 * Ressources lisibles, et la capacité qui autorise chacune.
 *
 * Table déclarative plutôt que `if` : ajouter une ressource lisible demain (les clients,
 * les commandes en ligne) sera une ligne ici, pas une branche dans la boucle.
 */
const PULLABLE = {
  inventory: { capability: 'pull_inventory' },
  product: { capability: 'pull_catalog' },
};

/**
 * Nombre de pages lues au maximum en une passe.
 *
 * Une borne est indispensable : un curseur mal géré par un éditeur — qui renverrait
 * toujours le même — produirait une boucle infinie tenant le worker et le verrou d'écriture
 * SQLite. Vingt pages suffisent à un rattrapage normal, et une passe suivante reprendra où
 * celle-ci s'est arrêtée.
 */
const MAX_PAGES = 20;

/**
 * Lit une ressource chez un éditeur et enfile ce qui en vient.
 *
 * @param {object} params
 * @param {string} params.storeId
 * @param {string} params.connectorId
 * @param {string} params.resource
 * @param {boolean} [params.full] ignorer le curseur et tout relire
 */
async function pull({ storeId, connectorId, resource, full = false }) {
  const spec = PULLABLE[resource];
  if (!spec) {
    throw new IntegrationError(
      `Ma Zone ne sait pas aller chercher « ${resource} » : ressources lisibles — `
      + `${Object.keys(PULLABLE).join(', ')}.`,
      400
    );
  }

  const connector = registry.get(connectorId);
  if (!connector) throw new IntegrationError(`Connecteur inconnu « ${connectorId} ».`, 404);

  const installation = installations.find(storeId, connectorId);
  if (!installation || installation.status !== installations.STATUS.ACTIVE) {
    throw new IntegrationError('Ce logiciel n\'est pas branché sur cette boutique.', 409);
  }
  if (!contract.supports(connector, spec.capability)) {
    throw new IntegrationError(
      `« ${connector.label} » ne sait pas fournir ${resource === 'product' ? 'son catalogue' : 'son stock'}.`,
      501
    );
  }

  const ctx = context.forInstallation({ connector, installation });
  let cursor = full ? null : cursors.value({ storeId, connectorId, resource });

  const report = { pages: 0, items: 0, queued: 0, duplicates: 0, declared: null, rejected: [] };
  const products = [];

  for (let page = 0; page < MAX_PAGES; page += 1) {
    // Appel réseau NU, hors transaction (Loi 7). Une lecture qui échoue laisse le curseur
    // intact : la passe suivante recommencera à la même page.
    const result = await connector.pull(resource, cursor, ctx);
    const items = result?.items || [];

    report.pages += 1;
    report.items += items.length;
    report.rejected.push(...(result?.rejected || []));

    for (const item of items) {
      const canonical = connector.toCanonical(resource, item);

      // Un catalogue est DÉCLARÉ, pas enfilé : créer un produit est une décision d'organe
      // qui a besoin d'un compte rendu immédiat pour le commerçant (« 3 997 importés, 3
      // refusés »). Le stock, lui, passe par la file : il n'a pas de destinataire humain
      // qui attend, et il doit être arbitré exactement comme un webhook.
      if (resource === 'product') {
        products.push(canonical);
        continue;
      }

      const { accepted } = inbox.accept({
        connectorId,
        storeId,
        resource,
        payload: item,
        // Clé dérivée de l'ÉTAT lu, pas de l'instant : relire la même valeur inchangée ne
        // produit pas un deuxième message, et c'est ce qui évite le piétinement du journal
        // de conflits sur les produits non mappés.
        idempotencyKey: idempotencyKeyFor({ connectorId, resource, canonical }),
        sourceUpdatedAt: canonical.sourceUpdatedAt ?? null,
      });

      if (accepted) report.queued += 1;
      else report.duplicates += 1;
    }

    cursor = result?.nextCursor ?? null;
    cursors.save({ storeId, connectorId, resource, cursor, itemCount: items.length });

    if (!cursor) break;
  }

  if (products.length) {
    report.declared = declare.declareProducts({
      storeId, connector, items: products, actor: installation.installed_by,
    });
  }

  logger.info('Lecture chez un logiciel tiers', {
    storeId, connectorId, resource, ...summary(report),
  });

  return report;
}

/**
 * Clé d'idempotence d'un élément lu.
 *
 * Contient la VALEUR proposée. C'est contre-intuitif — une clé d'idempotence désigne
 * d'ordinaire une opération, pas son contenu — et c'est indispensable ici : deux lectures
 * successives du même produit avec le même stock sont bien le même message, tandis qu'un
 * stock qui a changé est un message neuf qui doit être traité.
 */
function idempotencyKeyFor({ connectorId, resource, canonical }) {
  const parts = [
    'pull', connectorId, resource,
    canonical.externalId ?? canonical.reference ?? 'sans-id',
    canonical.externalLocationId ?? '-',
    canonical.onHand ?? canonical.quantity ?? '-',
    canonical.sourceUpdatedAt ?? '-',
  ];
  return parts.join(':');
}

/**
 * Réconcilie une boutique : relit tout ce que ses logiciels savent fournir.
 *
 * Ne lève pas si un connecteur échoue : les autres doivent quand même être réconciliés. Un
 * éditeur en panne ne doit pas empêcher de confronter le stock d'un second logiciel.
 */
async function reconcileStore({ storeId, full = false }) {
  const report = [];

  for (const installation of installations.forStore(storeId)) {
    const connector = registry.get(installation.connector_id);
    if (!connector) continue;

    for (const [resource, spec] of Object.entries(PULLABLE)) {
      if (!contract.supports(connector, spec.capability)) continue;

      try {
        const result = await pull({
          storeId, connectorId: connector.id, resource, full,
        });
        report.push({ connectorId: connector.id, resource, ok: true, ...summary(result) });
      } catch (err) {
        logger.warn('Réconciliation impossible', {
          storeId, connectorId: connector.id, resource, reason: err.message,
        });
        report.push({
          connectorId: connector.id, resource, ok: false, reason: err.message,
        });
      }
    }
  }

  return { storeId, reconciled: report };
}

/**
 * Boutiques à réconcilier, les plus anciennement lues d'abord.
 *
 * Renvoie des objets porteurs d'un `id` : c'est ce que `worker.createWorker` attend pour
 * pouvoir journaliser un échec. Le worker de réconciliation réutilise ainsi la mécanique de
 * bail des deux files, et donc sa garantie d'unicité — deux réconciliations simultanées de
 * la même boutique produiraient deux fois les mêmes messages.
 */
function due(limit = 5, { staleMinutes = 30 } = {}) {
  const candidates = [];

  for (const connectorId of registry.ids()) {
    const connector = registry.get(connectorId);
    const readable = Object.entries(PULLABLE)
      .filter(([, spec]) => contract.supports(connector, spec.capability))
      .map(([resource]) => resource);
    if (!readable.length) continue;

    for (const storeId of installations.storesFor(connectorId)) {
      for (const resource of readable) {
        const state = cursors.get({ storeId, connectorId, resource });
        if (state?.last_pulled_at && !isStale(state.last_pulled_at, staleMinutes)) continue;
        candidates.push({
          id: `${storeId}:${connectorId}:${resource}`, storeId, connectorId, resource,
        });
      }
    }
  }

  return candidates.slice(0, limit);
}

function isStale(lastPulledAt, staleMinutes) {
  const last = Date.parse(`${String(lastPulledAt).replace(' ', 'T')}Z`);
  if (!Number.isFinite(last)) return true;
  return Date.now() - last >= staleMinutes * 60_000;
}

function summary(report) {
  return {
    pages: report.pages,
    items: report.items,
    queued: report.queued,
    duplicates: report.duplicates,
    created: report.declared?.created ?? 0,
    updated: report.declared?.updated ?? 0,
    rejected: (report.rejected?.length ?? 0) + (report.declared?.rejected?.length ?? 0),
  };
}

module.exports = { PULLABLE, MAX_PAGES, pull, reconcileStore, due };
