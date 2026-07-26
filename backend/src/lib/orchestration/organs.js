/**
 * Orchestration — annuaire des opérations d'organe.
 *
 * Un plan d'intention ne nomme que des couples `organe.action`. Ce fichier est le
 * SEUL endroit qui sait ce que ces noms désignent réellement. Conséquence
 * recherchée : le process manager n'importe aucun organe, et un plan ne contient
 * aucun appel de fonction.
 *
 * Une opération est une fonction `(params, ctx) => résultat`. Elle est mince par
 * construction : si un adaptateur se met à calculer, c'est que la règle appartenait
 * à l'organe et qu'on vient de la lui voler.
 *
 * GRANULARITÉ DES ÉTAPES — décision structurante, à ne pas défaire par erreur.
 * Une étape correspond à UNE décision d'organe validable atomiquement, pas à une
 * ligne de code. `orders.create` réserve le stock ET crée la commande dans la même
 * transaction : découper ces deux gestes en deux étapes de saga créerait un état
 * intermédiaire « stock réservé, commande inexistante » qui n'existe pas
 * aujourd'hui. Une compensation ne rattrape jamais aussi bien qu'une transaction
 * qui n'a pas eu lieu.
 *
 * LOI 16 — les opérations listées ici sont des actes MÉTIER de Ma Zone. Aucune ne parle
 * à un logiciel tiers. `adapters/integration.js` fait exception à une seule chose : il
 * nomme les opérations qui, un jour, sortiront de Ma Zone. Il ne les met pas en œuvre et
 * ne le fera jamais — traduction, authentification, mapping, webhook, synchronisation et
 * protocole appartiennent exclusivement à l'Integration Engine et aux connecteurs.
 *
 * Règle pour les ajouts futurs : un adaptateur de ce dossier ne doit importer que des
 * organes de `lib/`. Le jour où l'un d'eux importe un SDK, un client HTTP ou un
 * connecteur, la frontière de substitution est franchie.
 */

const catalog = require('./adapters/catalog');
const notifications = require('./adapters/notifications');
const events = require('./adapters/events');
const wallet = require('./adapters/wallet');
const integration = require('./adapters/integration');

/**
 * Les organes sont résolus À L'APPEL, pas au chargement.
 *
 * `lib/orders` orchestre son panier en formulant des intentions, donc il importe
 * l'orchestration, qui importe ce fichier. Un `require` en tête de module figerait
 * une référence vers un module encore à moitié construit ; là, chaque appel obtient
 * l'organe complet. Le cache de Node rend le coût nul.
 */
const orders = () => require('../orders');
const inventory = () => require('../inventory');
const dispatch = () => require('../dispatch');

/**
 * @typedef {(params: object, ctx: object) => any} Operation
 */

const ORGANS = {
  orders: {
    /**
     * Crée la vente et retient son stock, en une transaction.
     *
     * Le client est l'AUTEUR de l'intention, pas un paramètre : personne ne commande
     * au nom de quelqu'un d'autre, et une intention ne doit pas offrir le moyen de
     * l'essayer.
     */
    create: (params, ctx) => orders().createOrder({
      clientId: ctx.actor,
      productId: params.productId,
      quantity: params.quantity,
      deliveryAddress: params.deliveryAddress,
      deliveryLat: params.deliveryLat,
      deliveryLng: params.deliveryLng,
      // Pas de clé transmise au moteur : l'idempotence est tenue une seule fois, au
      // niveau de l'intention. Deux garde-fous sur la même clé donneraient deux
      // vérités possibles sur ce qui a été rejoué.
    }),

    /** Annule la vente, libère sa réservation et sa mission. */
    cancel: (params, ctx) => orders().cancelOrder(orderIdOf(params, ctx), {
      actor: ctx.actor,
      reason: params.reason || null,
    }),

    /** Vérifie que le demandeur est bien le client de la commande. */
    assertClientOwns: (params, ctx) => {
      const order = orders().getOrderRow(params.orderId);
      if (!order || order.client_id !== ctx.actor) {
        const err = new Error('Commande introuvable');
        err.status = 404;
        throw err;
      }
      return { orderId: order.id, storeId: order.store_id };
    },
  },

  inventory: {
    reserve: (params, ctx) => inventory().reserve({
      productId: params.productId,
      quantity: params.quantity,
      reference: params.reference || ctx.runId,
      actor: ctx.actor,
    }),

    release: (params, ctx) => inventory().release({
      productId: params.productId,
      quantity: params.quantity,
      reference: params.reference || ctx.runId,
      actor: ctx.actor,
      reason: 'compensation d\'orchestration',
    }),

    /**
     * Fixe le stock VENDABLE d'un produit.
     *
     * Le produit peut venir d'une étape précédente : déclarer un catalogue crée le
     * produit puis lui donne son stock, et le second geste ne connaît pas l'identifiant
     * du premier avant qu'il ait eu lieu.
     */
    declareSellable: (params, ctx) => inventory().declareSellable({
      productId: productIdOf(params, ctx),
      sellable: params.quantity,
      actor: ctx.actor,
    }),
  },

  dispatch: {
    /** Cherche un livreur pour une commande déjà créée. */
    findDriver: (params, ctx) => {
      const attempt = dispatch().tryDispatchNewOrder(orderIdOf(params, ctx), ctx.io);
      return {
        outcome: attempt?.offer ? 'offered' : (attempt?.mission ? 'assigned' : 'pending_driver'),
        mission: attempt?.mission || null,
      };
    },

    /** Libère la mission d'une commande. */
    releaseMission: (params, ctx) => {
      dispatch().releaseMissionForOrder(orderIdOf(params, ctx));
      return { released: true };
    },

    /** Propose une course en attente aux livreurs qu'une annulation a libérés. */
    reassignFreedDrivers: (params, ctx) => {
      const cancelled = ctx.results['orders.cancel'];
      const mission = cancelled?.mission;
      const freed = [...new Set([mission?.driver_id, mission?.offered_to_driver_id].filter(Boolean))];
      for (const driverId of freed) dispatch().assignPendingOrdersToDriver(driverId, ctx.io);
      return { freed };
    },
  },

  catalog,
  notifications,
  events,
  wallet,

  // Énumérées une par une, et pas répandues avec `...` : l'adaptateur expose aussi de
  // quoi se faire prendre en charge par un organe (`provide`), qui n'est pas une
  // opération d'orchestration et n'a rien à faire dans l'annuaire.
  integration: {
    pushSale: integration.pushSale,
    pushCancel: integration.pushCancel,
    pushStockMovement: integration.pushStockMovement,
  },
};

/**
 * L'identifiant de commande vient soit des paramètres, soit du résultat de l'étape
 * de création. Une intention de vente ne connaît pas ce numéro avant de l'avoir créé.
 */
function orderIdOf(params, ctx) {
  return params.orderId || ctx.results['orders.create']?.order?.id;
}

/** Même logique pour un produit : déclaré à l'étape d'avant, ou fourni directement. */
function productIdOf(params, ctx) {
  return params.productId || ctx.results['catalog.declareProduct']?.product?.id;
}

const ORGAN_NAMES = Object.keys(ORGANS);

/** L'organe existe-t-il ? */
function hasOrgan(name) {
  return Object.prototype.hasOwnProperty.call(ORGANS, name);
}

/** L'opération existe-t-elle sur cet organe ? */
function hasOperation(organ, action) {
  return hasOrgan(organ) && typeof ORGANS[organ][action] === 'function';
}

/** @returns {Operation} */
function operation(organ, action) {
  if (!hasOperation(organ, action)) {
    throw new Error(`[Orchestration] opération inconnue « ${organ}.${action} »`);
  }
  return ORGANS[organ][action];
}

/** Inventaire des opérations disponibles. Diagnostic et documentation. */
function describe() {
  return Object.fromEntries(
    ORGAN_NAMES.map((organ) => [organ, Object.keys(ORGANS[organ])])
  );
}

module.exports = { ORGANS, ORGAN_NAMES, hasOrgan, hasOperation, operation, describe };
