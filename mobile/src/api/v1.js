/**
 * Client de l'API v1 — la surface versionnée.
 *
 * Étape 7 de ROADMAP_ORGANE_ORCHESTRATION_MAZONE.md. Fichier SÉPARÉ de `api/index.js`, et
 * la séparation est le point : elle rend la bascule lisible. Un appel importé depuis
 * `../api` va sur l'API historique, un appel importé depuis `../api/v1` va sur la
 * versionnée. Savoir où en est la migration devient une recherche de deux secondes, au lieu
 * d'une relecture de deux cents lignes d'URL.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ÉCRAN PAR ÉCRAN, DERRIÈRE UN FLAG, EN COMMENÇANT PAR LE COMMERÇANT
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * `/api` reste la valeur par défaut, et ce n'est pas de la timidité. Une application mobile
 * ne se met pas à jour parce qu'on a livré un backend : entre notre publication et le
 * téléphone d'un client, il y a la validation d'un store et la bonne volonté de
 * l'utilisateur. Basculer tout l'appel réseau d'un coup, c'est parier que dix-neuf routes
 * neuves se comportent exactement comme les anciennes sur des écrans qu'on n'a pas réécrits.
 *
 * Les écrans COMMERÇANT d'abord parce que ce sont ceux qui gagnent quelque chose : la v1
 * leur montre le stock physique, les unités promises et le vendable séparément, là où
 * l'API historique ne pouvait donner qu'un seul nombre — et devait deviner ce que le
 * commerçant voulait dire en le réenregistrant.
 *
 * Les écrans CLIENT ne gagnent rien pour l'instant : `available` y arrive déjà, sous le nom
 * `quantity`. Les migrer sans bénéfice serait du risque gratuit ; ils suivront quand `/api`
 * approchera de sa fin de vie (date dans `backend/src/lib/sunset.js`).
 */

import { client } from './index';
import { FEATURES } from '../config';

const V1 = '/api/v1';

/** Une clé d'idempotence n'a de valeur que si elle survit au réessai qui l'utilise. */
function idempotencyKey(scope) {
  const random = Math.random().toString(36).slice(2, 10);
  return `${scope}-${Date.now()}-${random}`;
}

// ── Inventaire (commerçant) ───────────────────────────────────────────────────

/** Les quatre valeurs de stock de toute une boutique, en une requête. */
export const getStoreInventory = (storeId) =>
  client.get(`${V1}/inventory?store_id=${encodeURIComponent(storeId)}`);

/** L'état d'un produit, avec `adopted` qui dit si l'organe le suit déjà. */
export const getProductInventory = (productId) =>
  client.get(`${V1}/inventory/${productId}`);

/**
 * Déclare le stock PHYSIQUE d'un produit.
 *
 * Valeur absolue, jamais un delta. Deux conséquences pratiques, et la seconde est un
 * compromis assumé :
 *
 *   · rejouer la requête après un timeout ne double rien — c'est ce qui dispense cette
 *     route d'une clé d'idempotence ;
 *   · si deux membres de l'équipe modifient le même produit en même temps, le dernier
 *     écrit gagne. L'API historique, qui envoyait des deltas, additionnait les deux. Pour
 *     un stock déclaré par une boutique, le réessai réseau est bien plus fréquent que la
 *     saisie simultanée : le compromis va donc dans ce sens, et l'écran affiche toujours la
 *     valeur renvoyée par le serveur plutôt que celle qu'il espérait.
 */
export const declareOnHand = (productId, onHand, reason) =>
  client.patch(`${V1}/inventory/${productId}`, { on_hand: onHand, ...(reason ? { reason } : {}) });

/** Règle la marge de sécurité commerciale, sans toucher au physique. */
export const declareSafetyBuffer = (productId, safetyBuffer) =>
  client.patch(`${V1}/inventory/${productId}`, { safety_buffer: safetyBuffer });

/** Pourquoi ce stock a bougé. */
export const getStockMovements = (productId, limit = 50) =>
  client.get(`${V1}/inventory/${productId}/movements?limit=${limit}`);

// ── Intentions ────────────────────────────────────────────────────────────────

/**
 * Formule une intention. La clé d'idempotence est obligatoire côté serveur (400 sans
 * elle) : elle est donc générée ici, jamais laissée au bon vouloir de l'appelant.
 */
export const runIntent = (intentId, params = {}) =>
  client.post(`${V1}/intents/${intentId}`, { params }, {
    headers: { 'Idempotency-Key': idempotencyKey(intentId) },
  });

/** Ce que mon rôle peut formuler, avec les paramètres attendus. */
export const getIntents = () => client.get(`${V1}/intents`);

// ── Catalogue et commandes ────────────────────────────────────────────────────

export const getStoresV1 = (params = {}) => {
  const query = Object.entries(params)
    .filter(([, value]) => value != null && value !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
  return client.get(`${V1}/stores${query ? `?${query}` : ''}`);
};

export const getStoreProductsV1 = (storeId) => client.get(`${V1}/stores/${storeId}/products`);
export const getProductV1 = (productId) => client.get(`${V1}/products/${productId}`);
export const getMyOrdersV1 = () => client.get(`${V1}/orders/mine`);
export const getStoreOrdersV1 = (storeId) =>
  client.get(`${V1}/orders?store_id=${encodeURIComponent(storeId)}`);
export const getOrderV1 = (orderId) => client.get(`${V1}/orders/${orderId}`);
export const getOrderJournalV1 = (orderId) => client.get(`${V1}/orders/${orderId}/journal`);
export const getMyDeliveriesV1 = () => client.get(`${V1}/deliveries/mine`);

// ── Intégrations ──────────────────────────────────────────────────────────────

export const getIntegrationsV1 = (storeId) =>
  client.get(`${V1}/integrations${storeId ? `?store_id=${encodeURIComponent(storeId)}` : ''}`);
export const getConnectorConflictsV1 = (connectorId, storeId) =>
  client.get(`${V1}/integrations/${connectorId}/conflicts?store_id=${encodeURIComponent(storeId)}`);

/** Ce qui est effectivement basculé aujourd'hui. Lu par les écrans concernés. */
export const usingV1 = FEATURES;
