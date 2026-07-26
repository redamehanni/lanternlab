/**
 * Integration Engine — façade.
 *
 * L'organe qui traverse la frontière. Le seul.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * LOI 16 — TOUT CE QUI TOUCHE À UN LOGICIEL TIERS S'ARRÊTE ICI.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * L'Organe d'Orchestration ne dialogue jamais directement avec un logiciel tiers : il
 * orchestre des intentions métier. Traduction, authentification, mapping, webhook,
 * synchronisation, protocole, identifiant externe, réconciliation : tout cela vit dans ce
 * dossier, et nulle part ailleurs.
 *
 * LE SENS DES DÉPENDANCES EST LA CLÉ, ET IL EST INVERSÉ EXPRÈS. Cet organe connaît
 * l'orchestration — il lui déclare ce qu'il sait faire. L'orchestration ne le connaît pas.
 * C'est ce qui rend la SUBSTITUTION PROGRESSIVE possible : supprimer ce dossier laisse un
 * système qui démarre, vend, et signale simplement au commerçant que ses ventes ne
 * partent nulle part (Loi 12). L'inverse — une orchestration qui importerait des
 * connecteurs — rendrait chaque retrait de logiciel tiers une réécriture du cœur.
 *
 * Vérifié mécaniquement : `test/integration.test.js` et l'étape CI « Loi 16 ».
 */

const logger = require('../logger');
const orchestration = require('../orchestration');

const appConfig = require('../../config/env');

const contract = require('./contract');
const registry = require('./connectorRegistry');
const installations = require('./installations');
const bindings = require('./bindings');
const conflicts = require('./conflicts');
const outbox = require('./outbox');
const inbox = require('./inbox');
const worker = require('./worker');
const sync = require('./sync');
const importer = require('./importer');
const secretsVault = require('./secrets');
const oauth = require('./oauth');
const puller = require('./puller');
const cursors = require('./cursors');
const context = require('./context');
const http = require('./http');
const { IntegrationError, SyncRejectedError } = require('./errors');

// Chargement des connecteurs. Chacun s'auto-déclare, comme les types d'événement.
require('./connectors');

// ── Déclaration des capacités à l'orchestration ───────────────────────────────

/**
 * Capacités partagées avec l'orchestration.
 *
 * L'orchestration en connaît trois, ce moteur en connaît cinq. L'écart est normal :
 * `pull_catalog` n'est pas une étape de plan, c'est une chose qu'un connecteur sait faire.
 * Seules les capacités que l'orchestration nomme dans ses plans ont besoin d'un résolveur.
 */
const ORCHESTRATED_CAPABILITIES = ['push_sales', 'push_inventory', 'pull_inventory'];

/**
 * Branche les résolveurs de capacités.
 *
 * À partir de cet appel, une étape `optional / requires: 'push_sales'` cesse d'être
 * systématiquement reportée : elle s'exécute pour les boutiques qui ont un connecteur
 * capable, et reste reportée pour les autres. Aucun plan d'intention ne change — c'est
 * précisément la promesse de l'étape 5 mise à l'épreuve.
 */
function registerCapabilities() {
  for (const capability of ORCHESTRATED_CAPABILITIES) {
    orchestration.registerCapability(capability, (context) => {
      const storeId = resolveStoreId(context);
      if (!storeId) return false;
      return installations.capabilitiesForStore(storeId).includes(capability);
    });
  }
  return ORCHESTRATED_CAPABILITIES;
}

/**
 * De quelle boutique parle-t-on ?
 *
 * L'orchestration passe le contexte de l'intention sans savoir ce qu'on en fera — elle
 * ne doit surtout pas se mettre à transporter des notions d'intégration. C'est donc à ce
 * moteur de retrouver la boutique à partir de ce qui est là.
 *
 * Lecture directe des tables plutôt qu'appel d'organe : `products` et `orders` n'ont pas
 * de lecteur d'organe pour cette question, et en inventer un ici serait pire. Dette
 * assumée, bornée à cette fonction.
 */
function resolveStoreId(context = {}) {
  if (context.storeId) return context.storeId;

  const db = require('../../db');

  if (context.productId) {
    const row = db.prepare('SELECT store_id FROM products WHERE id = ?').get(context.productId);
    if (row) return row.store_id;
  }
  if (context.orderId) {
    const row = db.prepare('SELECT store_id FROM orders WHERE id = ?').get(context.orderId);
    if (row) return row.store_id;
  }
  return null;
}

// ── Opérations appelées par l'orchestration ───────────────────────────────────

/**
 * Enfile une vente vers les logiciels de la boutique.
 *
 * Une vente peut partir vers PLUSIEURS logiciels : un commerçant peut avoir une caisse et
 * une boutique en ligne. Un message par connecteur capable, chacun avec sa propre clé
 * d'idempotence — sinon le second écraserait le premier et une seule des deux
 * destinations serait servie.
 */
function pushSale(params, ctx) {
  const order = params.order || ctx?.results?.['orders.create']?.order;
  if (!order) throw new IntegrationError('Aucune vente à transmettre.', 400);

  return fanOut({
    storeId: order.store_id,
    capability: 'push_sales',
    resource: 'order',
    operation: 'sale',
    idempotencySuffix: `sale-${order.id}`,
    payload: canonicalOrder(order, 'vente'),
  });
}

/** Enfile l'annulation d'une vente déjà transmise. */
function pushCancel(params, ctx) {
  const cancelled = ctx?.results?.['orders.cancel']?.order || params.order;
  if (!cancelled) throw new IntegrationError('Aucune annulation à transmettre.', 400);

  return fanOut({
    storeId: cancelled.store_id,
    capability: 'push_sales',
    resource: 'order',
    operation: 'cancel',
    idempotencySuffix: `cancel-${cancelled.id}`,
    payload: canonicalOrder(cancelled, 'annulation'),
  });
}

/** Enfile un mouvement de stock décidé par Ma Zone. */
function pushStockMovement(params, ctx) {
  const productId = params.productId;
  if (!productId) throw new IntegrationError('Aucun produit à synchroniser.', 400);

  const db = require('../../db');
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(productId);
  if (!product) throw new IntegrationError('Produit introuvable.', 404);

  return fanOut({
    storeId: product.store_id,
    capability: 'push_inventory',
    resource: 'inventory',
    operation: 'movement',
    idempotencySuffix: `stock-${productId}-${ctx?.runId || 'direct'}`,
    payload: {
      entityType: bindings.ENTITY_TYPE.PRODUCT,
      entityId: productId,
      reference: product.barcode,
      quantity: params.quantity ?? null,
      runId: ctx?.runId ?? null,
    },
  });
}

/**
 * Enfile un message vers tous les connecteurs capables d'une boutique.
 *
 * Renvoie ce qui a été enfilé plutôt que de lever quand aucun connecteur n'est capable :
 * l'orchestration a déjà vérifié la capacité avant d'appeler, et lever ici sur une course
 * — un connecteur débranché entre-temps — ferait échouer une vente pour un détail de
 * synchronisation.
 */
function fanOut({ storeId, capability, resource, operation, payload, idempotencySuffix }) {
  const targets = installations
    .forStore(storeId)
    .filter((i) => contract.supports(registry.get(i.connector_id), capability));

  const queued = [];
  for (const installation of targets) {
    const { message, enqueued } = outbox.enqueue({
      storeId,
      connectorId: installation.connector_id,
      resource,
      operation,
      payload,
      idempotencyKey: `${installation.connector_id}:${idempotencySuffix}`,
    });
    queued.push({ connectorId: installation.connector_id, messageId: message.id, enqueued });
  }

  return { queued, connectors: queued.length };
}

/** Vue canonique d'une commande. Aucun champ propre à un éditeur : c'est du CDM. */
function canonicalOrder(order, operation) {
  const db = require('../../db');
  const product = db.prepare('SELECT name, barcode FROM products WHERE id = ?').get(order.product_id);

  return {
    entityType: bindings.ENTITY_TYPE.ORDER,
    entityId: order.id,
    orderId: order.id,
    createdAt: order.created_at,
    productId: order.product_id,
    productName: product?.name ?? null,
    reference: product?.barcode ?? null,
    quantity: order.quantity,
    totalPrice: order.total_price,
    operation,
  };
}

// ── Réception d'un webhook ────────────────────────────────────────────────────

/**
 * Accepte un webhook, après vérification, sans rien traiter.
 *
 * L'ordre des trois refus ci-dessous n'est pas indifférent : on refuse d'abord ce qui
 * n'existe pas, puis ce qui n'est pas autorisé, et seulement ensuite on regarde le contenu.
 * Un contrôle de signature placé après une lecture de charge est un contrôle qu'on a déjà
 * contourné.
 *
 * DEUX SERVICES SONT FOURNIS AU CONNECTEUR POUR QU'IL PUISSE VÉRIFIER (étape 8), et ils sont
 * l'un et l'autre du ressort du moteur :
 *
 *   `app`           les identifiants de l'application Ma Zone chez l'éditeur, avec lesquels
 *                   presque tous signent leurs notifications. Ils vivent dans l'environnement
 *                   du serveur, pas dans un connecteur.
 *   `resolveStore`  la traduction « identifiant de compte chez l'éditeur → boutique Ma Zone ».
 *                   Le connecteur dit OÙ regarder (« shop_domain »), le moteur cherche. Un
 *                   connecteur qui interrogerait la base lui-même en deviendrait un usager.
 */
function receiveWebhook({ connectorId, headers = {}, rawBody = null, payload = null }) {
  const connector = registry.get(connectorId);
  if (!connector) throw new IntegrationError(`Connecteur inconnu « ${connectorId} ».`, 404);

  if (!contract.supports(connector, 'webhooks') || typeof connector.verifyWebhook !== 'function') {
    throw new IntegrationError(
      `Le connecteur « ${connector.label} » ne reçoit pas de notifications temps réel.`,
      501
    );
  }

  // La vérification appartient au connecteur : lui seul connaît le schéma de signature de
  // son éditeur. Ce moteur ne fait qu'exiger un verdict, et n'accepte que « oui ».
  const verdict = connector.verifyWebhook({
    headers,
    rawBody,
    payload,
    app: appCredentialsOrNull(connector),
    resolveStore: (key, value) => installations.findByConfig(connector.id, key, value),
  });

  if (!verdict || verdict.valid !== true) {
    // 401 et non 400 : ce n'est pas une requête mal formée, c'est une origine non prouvée.
    throw new IntegrationError('Origine du message non vérifiée.', 401);
  }

  // Le commerçant a désinstallé l'application depuis son éditeur. Ne pas le traiter serait le
  // piège classique : Ma Zone continuerait d'appeler une API avec un jeton révoqué, en
  // réessayant, jusqu'à ce que quelqu'un lise les journaux. On débranche de notre côté, ce qui
  // purge aussi le jeton devenu inutile — et le commerçant retrouve un mode `mazone`
  // opérationnel plutôt qu'une intégration fantôme.
  if (verdict.uninstalled) {
    if (verdict.storeId) {
      installations.disconnect({ storeId: verdict.storeId, connectorId: connector.id });
      logger.info('Logiciel désinstallé chez l\'éditeur, connecteur débranché', {
        connectorId: connector.id, storeId: verdict.storeId,
      });
    }
    return { messageId: null, duplicate: false, uninstalled: true };
  }

  const { message, accepted } = inbox.accept({
    connectorId,
    storeId: verdict.storeId ?? null,
    resource: verdict.resource,
    payload: verdict.payload ?? payload,
    // La clé vient de l'ÉDITEUR (identifiant d'événement), jamais de nous : c'est ce qui
    // rend une même notification rejouée reconnaissable comme un doublon.
    idempotencyKey: verdict.idempotencyKey,
    sourceUpdatedAt: verdict.sourceUpdatedAt ?? null,
  });

  logger.debug('Webhook accepté', { connectorId, messageId: message.id, duplicate: !accepted });
  return { messageId: message.id, duplicate: !accepted };
}

/**
 * Identifiants d'application, ou `null` s'ils n'existent pas.
 *
 * Un connecteur sans connexion déléguée n'a pas d'application déclarée chez un éditeur, et
 * exiger ces identifiants ferait échouer la réception d'un webhook pour une raison qui ne le
 * concerne pas. Un connecteur qui EN A besoin refusera de lui-même la vérification faute de
 * secret, ce qui est le bon comportement : 401, pas 500.
 */
function appCredentialsOrNull(connector) {
  if (!connector.oauth) return null;
  try {
    return oauth.appCredentials(connector);
  } catch {
    return null;
  }
}

// ── Connexion d'un logiciel ───────────────────────────────────────────────────

/**
 * Ce qu'il faut fournir pour brancher un logiciel, en vocabulaire d'écran.
 *
 * L'écran « Mes intégrations » ne doit contenir AUCUNE connaissance d'éditeur : il lit cette
 * description et dessine ce qu'elle dit. C'est ce qui fait que le connecteur suivant
 * n'ajoutera pas une ligne au mobile — le formulaire de connexion se déduit du contrat.
 */
function connectionForm(connectorId) {
  const connector = registry.get(connectorId);
  if (!connector) throw new IntegrationError(`Connecteur inconnu « ${connectorId} ».`, 404);

  return {
    connectorId: connector.id,
    label: connector.label,
    mode: connector.connectionMode,
    // Champs à demander AVANT la redirection (identifiant de boutique chez l'éditeur), ou
    // champs à saisir intégralement (paire de clés d'API).
    fields: connector.connectionMode === contract.CONNECTION_MODE.DELEGATED
      ? (connector.oauth?.params || [])
      : (connector.credentialFields || []),
    scopes: connector.oauth?.scopes || [],
    // Une instance sans coffre ne doit pas proposer un bouton qui échouera.
    vaultReady: connector.requiresAuth ? secretsVault.available() : true,
    callbackReady: connector.connectionMode === contract.CONNECTION_MODE.DELEGATED
      ? !!appConfig.publicBaseUrl
      : true,
  };
}

/**
 * Ouvre une connexion déléguée : renvoie l'URL de consentement.
 *
 * Ne branche rien. Un commerçant qui abandonne devant l'écran de son éditeur ne doit pas
 * laisser derrière lui une installation qui prétend fonctionner.
 */
function beginConnection({ storeId, connectorId, actor = null, params = {} }) {
  const connector = registry.get(connectorId);
  if (!connector) throw new IntegrationError(`Connecteur inconnu « ${connectorId} ».`, 404);

  return oauth.begin({ connector, storeId, actor, params });
}

/**
 * Termine une connexion déléguée, à la redirection de l'éditeur.
 *
 * L'ordre — jetons rangés, connecteur branché, connexion vérifiée, abonnements posés —
 * n'est pas indifférent : chaque étape a besoin de la précédente, et un échec en fin de
 * chaîne doit tout défaire. Un demi-branchement est ce qui produit un commerçant persuadé
 * d'être connecté et un stock qui ne bouge pas.
 */
async function completeConnection({ connectorId, query }) {
  const connector = registry.get(connectorId);
  if (!connector) throw new IntegrationError(`Connecteur inconnu « ${connectorId} ».`, 404);

  const result = await oauth.complete({
    connector, query, install: installations.install,
  });

  // L'installation RELUE, et pas celle qu'on vient de créer : la vérification de connexion
  // apprend souvent quelque chose qui mérite d'être enregistré — l'établissement par défaut
  // de la boutique, par exemple. Rendre l'objet d'avant afficherait au commerçant un
  // branchement moins complet que celui qui vient d'être fait.
  const installation = await finishConnection(connector, result.installation);
  return { ...result, installation };
}

/**
 * Branche un logiciel dont le commerçant colle lui-même les identifiants.
 *
 * Le second mode de la famille, et il n'a rien d'un cas dégradé : les extensions de
 * boutique en ligne et les logiciels de gestion installés délivrent une paire de clés, pas
 * une redirection. Le chemin est plus court — pas de jeton d'état, pas d'échange — et
 * aboutit au même endroit : des secrets dans le coffre et une installation vérifiée.
 */
async function connectWithCredentials({ storeId, connectorId, values = {}, config = null, actor = null }) {
  const connector = registry.get(connectorId);
  if (!connector) throw new IntegrationError(`Connecteur inconnu « ${connectorId} ».`, 404);
  if (connector.connectionMode !== contract.CONNECTION_MODE.CREDENTIALS) {
    throw new IntegrationError(
      `« ${connector.label} » ne se connecte pas par saisie d'identifiants.`,
      400
    );
  }

  secretsVault.assertUsable();

  for (const field of connector.credentialFields) {
    const value = values?.[field.name];
    if (!value || String(value).trim() === '') {
      throw new IntegrationError(`« ${field.label} » est nécessaire.`, 400);
    }
    if (field.pattern && !new RegExp(field.pattern).test(String(value).trim())) {
      throw new IntegrationError(`« ${field.label} » n'a pas la forme attendue.`, 400);
    }
  }

  for (const field of connector.credentialFields) {
    secretsVault.put({
      storeId, connectorId, name: field.name, value: String(values[field.name]).trim(),
    });
  }

  try {
    const installation = installations.install({ storeId, connectorId, config, actor });
    return { installation: await finishConnection(connector, installation) };
  } catch (err) {
    secretsVault.forget({ storeId, connectorId });
    throw err;
  }
}

/**
 * Vérifie la connexion, puis pose les abonnements temps réel.
 *
 * ÉPROUVER LES IDENTIFIANTS MAINTENANT est ce qui distingue une intégration utilisable d'une
 * intégration « configurée ». Une clé fausse doit se révéler devant le commerçant qui vient
 * de la coller — pas trois heures plus tard, sous la forme d'un stock qui ne se met plus à
 * jour et d'une ligne dans un journal technique que personne ne lit.
 *
 * L'IMPORT INITIAL N'EST PAS DÉCLENCHÉ ICI, et c'est délibéré : le worker de réconciliation
 * voit une boutique sans curseur et va la lire de lui-même. Lancer une lecture complète dans
 * la requête HTTP du commerçant ferait attendre trente secondes pour un catalogue de quatre
 * mille articles, puis expirerait — en laissant l'import à moitié fait.
 */
async function finishConnection(connector, installation) {
  const ctx = context.forInstallation({
    connector,
    installation,
    extra: appConfig.publicBaseUrl
      ? { webhookUrl: `${appConfig.publicBaseUrl}/api/integration/webhooks/${connector.id}` }
      : {},
  });

  if (typeof connector.authenticate === 'function') {
    const verdict = await connector.authenticate(ctx);
    if (verdict && verdict.ok === false) {
      throw new IntegrationError(
        `${connector.label} a refusé ces identifiants : ${verdict.reason || 'accès refusé'}.`,
        401
      );
    }
  }

  if (contract.supports(connector, 'webhooks') && typeof connector.subscribeWebhooks === 'function') {
    if (!ctx.webhookUrl) {
      // Pas une panne : le logiciel est branché et sera lu périodiquement. Le commerçant
      // doit seulement savoir que le temps réel manque, et l'exploitant pourquoi.
      logger.warn('Abonnement temps réel impossible : PUBLIC_BASE_URL absente', {
        connectorId: connector.id, storeId: installation.store_id,
      });
    } else {
      try {
        await connector.subscribeWebhooks(ctx);
      } catch (err) {
        // Un abonnement raté ne défait PAS le branchement : la réconciliation périodique
        // suffit à faire vivre l'intégration, en moins bien. Tout annuler pour cela
        // priverait le commerçant d'un logiciel qui marche à 90 %.
        logger.warn('Abonnement aux notifications refusé', {
          connectorId: connector.id, storeId: installation.store_id, reason: err.message,
        });
      }
    }
  }

  return installations.find(installation.store_id, connector.id) || installation;
}

/**
 * Débranche un logiciel et rend sa procuration.
 *
 * Le commerçant reste OPÉRATIONNEL : ses produits, son stock et ses ventes sont à lui. Ce
 * geste retire une source, pas un catalogue — c'est le critère de réversibilité de la
 * roadmap, et il se vérifie (`test/shopify-connector.test.js`).
 */
function disconnect({ storeId, connectorId }) {
  return installations.disconnect({ storeId, connectorId });
}

// ── Lecture et réconciliation ─────────────────────────────────────────────────

/** Relit ce qu'un logiciel sait fournir, pour une ressource. */
function pull({ storeId, connectorId, resource, full = false }) {
  return puller.pull({ storeId, connectorId, resource, full });
}

/**
 * Réconcilie une boutique à la demande.
 *
 * Existe comme GESTE DU COMMERÇANT autant que d'exploitation : « mon stock ne me paraît pas
 * juste » doit avoir une réponse dans l'écran, pas un ticket de support. La réconciliation
 * périodique fait la même chose sans qu'on le demande, mais un bouton donne le contrôle.
 */
function reconcile({ storeId, full = false }) {
  return puller.reconcileStore({ storeId, full });
}

// ── Workers ───────────────────────────────────────────────────────────────────

let outboxWorker = null;
let inboxWorker = null;
let reconcileWorker = null;

/**
 * Intervalle du worker de réconciliation.
 *
 * Cinq minutes pour le RÉVEIL, ce qui ne veut pas dire cinq minutes par boutique : `due()`
 * ne propose que ce qui n'a pas été lu depuis un moment. Séparer la fréquence du réveil de
 * la fréquence des lectures est ce qui permet de rattraper vite une boutique en retard sans
 * relire en boucle celles qui sont à jour.
 */
const RECONCILE_INTERVAL_MS = 5 * 60_000;

/**
 * Démarre les workers.
 *
 * Lève si un worker tourne déjà ailleurs : c'est le comportement attendu, pas une gêne.
 * Deux workers sur la même file enverraient chaque vente deux fois chez l'éditeur.
 *
 * LE TROISIÈME WORKER RÉUTILISE LA MÊME MÉCANIQUE, ET C'EST LE POINT. La réconciliation
 * n'est pas une file, mais elle a exactement le même besoin d'unicité : deux réconciliations
 * simultanées de la même boutique liraient deux fois le même catalogue et doubleraient les
 * appels chez l'éditeur, jusqu'à se faire limiter. Écrire une seconde mécanique de bail
 * aurait été le début d'une divergence ; `createWorker` ne connaît que « ce qui est dû » et
 * « comment le traiter », ce qui suffit.
 */
function startWorkers({ intervalMs } = {}) {
  outboxWorker = worker.createWorker({
    name: 'outbox',
    due: (limit) => outbox.due(limit),
    handle: (message) => sync.deliver(message),
    intervalMs,
  });
  inboxWorker = worker.createWorker({
    name: 'inbox',
    due: (limit) => inbox.due(limit),
    handle: (message) => sync.ingest(message),
    intervalMs,
  });
  reconcileWorker = worker.createWorker({
    name: 'reconcile',
    due: (limit) => puller.due(limit),
    handle: (task) => puller.pull({
      storeId: task.storeId, connectorId: task.connectorId, resource: task.resource,
    }),
    intervalMs: intervalMs || RECONCILE_INTERVAL_MS,
    // Cinq lectures par réveil : une réconciliation est lourde chez l'éditeur, et rien
    // n'oblige à rattraper toutes les boutiques dans la même minute.
    batch: 5,
  });

  const started = [outboxWorker.start(), inboxWorker.start(), reconcileWorker.start()];
  return { started };
}

function stopWorkers() {
  outboxWorker?.stop();
  inboxWorker?.stop();
  reconcileWorker?.stop();
  outboxWorker = null;
  inboxWorker = null;
  reconcileWorker = null;
}

/**
 * Traite les deux files une fois, sans worker.
 *
 * Utilisé par les tests et par une commande d'exploitation. Ne prend AUCUN bail : c'est
 * un geste ponctuel et volontaire, pas une boucle concurrente.
 *
 * ASYNCHRONE DEPUIS L'ÉTAPE 8 : livrer un message à un éditeur est un appel réseau, et un
 * `drain()` qui rendrait la main avant la fin des envois donnerait à un test l'illusion
 * d'avoir observé une file vidée. Les appelants attendent — c'est une ligne de plus dans
 * chaque test, et la garantie que ce qu'ils vérifient a réellement eu lieu.
 */
async function drain({ batch = 50 } = {}) {
  const out = outbox.due(batch);
  for (const message of out) await sync.deliver(message);

  const inc = inbox.due(batch);
  for (const message of inc) sync.ingest(message);

  return { delivered: out.length, ingested: inc.length };
}

// ── Démarrage ─────────────────────────────────────────────────────────────────

/**
 * Branche l'organe au reste du système.
 *
 * Appelé une fois au démarrage. `workers: false` en test : une boucle de fond rend les
 * assertions non déterministes, et les tests pilotent `drain()` explicitement.
 */
function boot({ workers = true, intervalMs } = {}) {
  const capabilities = registerCapabilities();
  orchestration.provideIntegration({ pushSale, pushCancel, pushStockMovement });

  let workerState = { started: [] };
  if (workers) {
    try {
      workerState = startWorkers({ intervalMs });
    } catch (err) {
      // Un worker déjà pris n'empêche PAS le serveur de servir : les commandes passent,
      // la synchronisation attend. Refuser de démarrer serait une panne bien plus grave
      // que le retard qu'on évite.
      logger.warn('Workers de synchronisation non démarrés', { reason: err.message });
    }
  }

  logger.info('Integration Engine prêt', {
    connectors: registry.ids(),
    capabilities,
    workers: workerState.started.length,
  });

  return { connectors: registry.ids(), capabilities };
}

/**
 * État complet des intégrations d'une boutique, prêt à afficher.
 *
 * Une seule lecture pour tout l'écran, et surtout un seul endroit qui décide de ce qu'une
 * surface a le droit de savoir. Les identifiants n'en font PAS partie : `secretsVault.describe`
 * ne rend que des noms et des dates. Un écran qui afficherait « votre jeton : shpat_… » serait
 * une fuite, et la seule façon fiable de ne jamais l'écrire est de ne pas l'avoir sous la main.
 */
function stateForStore(storeId) {
  const installed = installations.forStore(storeId, { activeOnly: false });

  return {
    connectors: registry.ids().map((id) => {
      const connector = registry.get(id);
      const installation = installed.find((i) => i.connector_id === id) || null;

      return {
        ...registry.describe(id),
        form: connectionForm(id),
        installed: !!installation,
        status: installation?.status ?? null,
        config: installation?.config ?? null,
        credentials: installation
          ? secretsVault.describe({ storeId, connectorId: id })
          : [],
        reads: cursors.forStore(storeId).filter((c) => c.connector_id === id),
      };
    }),
    capabilities: installations.capabilitiesForStore(storeId),
    conflicts: conflicts.forStore(storeId, { limit: 20 }),
    pendingConflicts: conflicts.pendingCount(storeId),
    outbox: outbox.forStore(storeId, { limit: 20 }),
  };
}

module.exports = {
  boot,

  // Registre et branchement
  connectors: registry.list,
  describeConnector: registry.describe,
  install: installations.install,
  pause: installations.pause,
  forStore: installations.forStore,
  capabilitiesForStore: installations.capabilitiesForStore,
  stateForStore,

  // Connexion d'un logiciel (étape 8)
  connectionForm,
  beginConnection,
  completeConnection,
  connectWithCredentials,
  disconnect,
  refreshCredentials: oauth.refresh,

  // Lecture active et réconciliation
  pull,
  reconcile,
  readState: cursors.forStore,
  resetReads: cursors.reset,

  // Transport (exposé pour les tests : un connecteur s'éprouve hors ligne)
  useTransport: http.useTransport,
  resetTransport: http.resetTransport,

  // Import manuel
  inspectImport: importer.inspect,
  importCatalog: importer.importCatalog,
  exportSales: importer.exportSales,

  // Correspondances et conflits
  bind: bindings.bind,
  unbind: bindings.unbind,
  resolveBinding: bindings.resolve,
  bindingsFor: bindings.forEntity,
  conflictsForStore: conflicts.forStore,
  acknowledgeConflict: conflicts.acknowledge,
  pendingConflicts: conflicts.pendingCount,

  // Files
  receive: inbox.accept,
  receiveWebhook,
  drain,
  startWorkers,
  stopWorkers,
  outboxStats: outbox.stats,
  inboxStats: inbox.stats,
  deadLetters: outbox.deadLetters,
  reviveDeadLetter: outbox.revive,
  outboxForStore: outbox.forStore,

  // Opérations d'orchestration (exposées pour les tests ; l'orchestration les reçoit
  // par déclaration, elle ne vient jamais les chercher ici)
  pushSale,
  pushCancel,
  pushStockMovement,

  // Vocabulaire
  CONNECTOR_CAPABILITIES: contract.CONNECTOR_CAPABILITIES,
  CONNECTION_MODE: contract.CONNECTION_MODE,
  ENTITY_TYPE: bindings.ENTITY_TYPE,
  CONFLICT_REASON: conflicts.REASON,
  INSTALLATION_STATUS: installations.STATUS,
  IntegrationError,
  SyncRejectedError,
};
