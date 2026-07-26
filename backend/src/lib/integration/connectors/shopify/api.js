/**
 * Connecteur Shopify — le dialecte HTTP, et rien d'autre.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * TOUT CE FICHIER EST JETABLE. C'EST SA QUALITÉ PRINCIPALE.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Shopify est le PREMIER logiciel du marché branché sur Ma Zone, pas un partenaire
 * structurant. Le jour où un commerçant arrive avec Lightspeed, SumUp, Zettle, WooCommerce
 * ou Sage, l'ajout doit être un dossier voisin de celui-ci — jamais une modification du
 * moteur, du CDM, des organes ou de l'API.
 *
 * Ce fichier est donc écrit pour être supprimable. Tout ce qu'il contient est propre à un
 * éditeur : des chemins d'URL, une version d'API, un en-tête d'authentification, une façon
 * de paginer. Rien de tout cela ne remonte : le moteur ne connaît que `pull`, `push`,
 * `toCanonical`, `fromCanonical` et `verifyWebhook`.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * AUCUN `fetch` ICI, ET C'EST UNE RÈGLE DE FAMILLE
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Chaque appel passe par `ctx.request`, fourni par l'Integration Engine. Le connecteur
 * n'hérite donc pas seulement d'un client HTTP : il hérite du délai d'attente, du respect
 * des quotas, de la classification des échecs et de la testabilité hors ligne. Un
 * `fetch()` écrit ici contournerait les quatre, et la suite de conformité le refuse.
 */

const { IntegrationError } = require('../../errors');

/**
 * Version d'API ÉPINGLÉE, et date à laquelle il faut la regarder.
 *
 * Shopify publie une version par trimestre et en retire le support au bout d'un an. Une
 * intégration qui ne l'épingle pas ne casse pas le jour d'une mise à jour : elle casse un
 * matin, sans déploiement de notre part, sur la boutique d'un commerçant. Une version
 * épinglée transforme cette panne subie en tâche planifiée.
 *
 * La date de revue est écrite dans le code pour la même raison que les dates de
 * `lib/sunset.js` : une échéance qui ne vit que dans la tête de quelqu'un n'existe pas.
 */
const API_VERSION = '2026-07';
const API_VERSION_REVIEW = '2027-04-30';

/** Limite de page. 250 est le maximum accepté ; en dessous, on multiplie les appels. */
const PAGE_SIZE = 250;

/**
 * Domaine de boutique : `boutique.myshopify.com`, et rien d'autre.
 *
 * Ce motif n'est pas de la coquetterie de validation. Le domaine vient du commerçant et sert
 * à construire l'hôte de tous nos appels sortants : sans contrôle, une valeur choisie
 * enverrait le jeton d'accès d'une boutique vers un serveur choisi par l'appelant.
 */
const SHOP_DOMAIN = /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/;

function assertShopDomain(domain) {
  const clean = String(domain || '').trim().toLowerCase();
  if (!SHOP_DOMAIN.test(clean)) {
    throw new IntegrationError(
      `« ${domain} » n'est pas un domaine de boutique Shopify (attendu : boutique.myshopify.com).`,
      400
    );
  }
  return clean;
}

function base(shopDomain) {
  return `https://${assertShopDomain(shopDomain)}/admin/api/${API_VERSION}`;
}

/** Domaine de la boutique pour cette installation. */
function shopOf(ctx) {
  const domain = ctx?.config?.shop_domain;
  if (!domain) {
    throw new IntegrationError(
      'Cette installation ne dit pas de quelle boutique Shopify elle parle.',
      500
    );
  }
  return assertShopDomain(domain);
}

/**
 * En-tête d'authentification.
 *
 * Le jeton vient du coffre, par `ctx.credentials`. Il n'est ni journalisé, ni renvoyé, ni
 * stocké ailleurs — et ce fichier ne sait même pas comment il a été obtenu.
 */
function authHeaders(ctx) {
  const token = ctx?.credentials?.access_token;
  if (!token) {
    throw new IntegrationError(
      'Aucun jeton d\'accès pour cette boutique Shopify : reconnectez le logiciel.',
      401
    );
  }
  return { 'X-Shopify-Access-Token': token, accept: 'application/json' };
}

/** Appel authentifié. */
async function call(ctx, { method = 'GET', path, query = null, body = null, idempotent = null }) {
  const url = query
    ? `${base(shopOf(ctx))}${path}?${new URLSearchParams(query)}`
    : `${base(shopOf(ctx))}${path}`;

  return ctx.request({ method, url, headers: authHeaders(ctx), body, idempotent });
}

/**
 * Curseur de pagination, extrait de l'en-tête `Link`.
 *
 * Shopify a abandonné la pagination par numéro de page au profit d'un jeton opaque placé
 * dans un en-tête, et c'est une bonne chose : un catalogue qui change pendant qu'on le lit
 * fait sauter ou dupliquer des lignes avec une pagination par offset.
 *
 * Le jeton est rendu tel quel au moteur, qui le garde sans le comprendre (`cursors.js`).
 */
function nextPageInfo(headers) {
  const link = headers?.link || headers?.Link;
  if (!link) return null;

  for (const part of String(link).split(',')) {
    if (!part.includes('rel="next"')) continue;
    const match = part.match(/page_info=([^&>;\s]+)/);
    if (match) return match[1];
  }
  return null;
}

// ── Lectures ──────────────────────────────────────────────────────────────────

/**
 * Une page de produits.
 *
 * `updated_at_min` n'est utilisé QU'EN L'ABSENCE de curseur : Shopify refuse de combiner un
 * `page_info` avec d'autres filtres, et mélanger les deux produit une erreur 400 au milieu
 * d'une pagination — donc un import qui s'arrête à la deuxième page sans raison lisible.
 */
async function listProducts(ctx, cursor) {
  const query = cursor
    ? { limit: PAGE_SIZE, page_info: cursor }
    : { limit: PAGE_SIZE, status: 'active' };

  const response = await call(ctx, { path: '/products.json', query });
  return {
    products: response.body?.products || [],
    nextCursor: nextPageInfo(response.headers),
  };
}

/** Une page de niveaux de stock, éventuellement bornée à un établissement. */
async function listInventoryLevels(ctx, cursor) {
  const locationId = ctx?.config?.location_id;
  if (!locationId) {
    throw new IntegrationError(
      'Cette installation Shopify n\'a pas d\'établissement de référence : reconnectez le '
      + 'logiciel pour que Ma Zone sache quel stock lire.',
      409
    );
  }

  const query = cursor
    ? { limit: PAGE_SIZE, page_info: cursor }
    : { limit: PAGE_SIZE, location_ids: locationId };

  const response = await call(ctx, { path: '/inventory_levels.json', query });
  return {
    levels: response.body?.inventory_levels || [],
    nextCursor: nextPageInfo(response.headers),
  };
}

/** Établissements de la boutique. Lu à la connexion pour choisir celui de référence. */
async function listLocations(ctx) {
  const response = await call(ctx, { path: '/locations.json' });
  return response.body?.locations || [];
}

/** Fiche de la boutique. Sert de test de connexion : l'appel le moins coûteux qui existe. */
async function getShop(ctx) {
  const response = await call(ctx, { path: '/shop.json' });
  return response.body?.shop || null;
}

// ── Écritures ─────────────────────────────────────────────────────────────────

/**
 * Ajuste un niveau de stock d'une quantité SIGNÉE.
 *
 * `adjust` et non `set`, et la nuance est capitale en mode `pos`. « Poser » une valeur
 * absolue écraserait tout ce qui s'est passé en caisse depuis notre dernière lecture : deux
 * ventes au comptoir pendant que Ma Zone envoie son propre décrément, et le stock du
 * commerçant remonte comme si ces deux ventes n'avaient pas eu lieu. Un ajustement relatif
 * dit ce que Ma Zone sait — « une unité est partie » — sans prétendre connaître le reste.
 */
async function adjustInventory(ctx, { inventoryItemId, locationId, delta }) {
  const response = await call(ctx, {
    method: 'POST',
    path: '/inventory_levels/adjust.json',
    body: {
      location_id: Number(locationId),
      inventory_item_id: Number(inventoryItemId),
      available_adjustment: Number(delta),
    },
    // Un ajustement relatif n'est PAS rejouable : deux envois retirent deux unités. Le
    // réessai appartient à l'Outbox, qui ne reprend un message que s'il n'est pas parti.
    idempotent: false,
  });

  return response.body?.inventory_level || null;
}

/** Abonne Ma Zone à un sujet de notification. */
async function createWebhook(ctx, { topic, address }) {
  const response = await call(ctx, {
    method: 'POST',
    path: '/webhooks.json',
    body: { webhook: { topic, address, format: 'json' } },
    idempotent: false,
  });
  return response.body?.webhook || null;
}

/** Abonnements existants. Lus avant d'en créer, pour ne pas les empiler à chaque connexion. */
async function listWebhooks(ctx) {
  const response = await call(ctx, { path: '/webhooks.json' });
  return response.body?.webhooks || [];
}

module.exports = {
  API_VERSION,
  API_VERSION_REVIEW,
  PAGE_SIZE,
  SHOP_DOMAIN,
  assertShopDomain,
  shopOf,
  nextPageInfo,
  listProducts,
  listInventoryLevels,
  listLocations,
  getShop,
  adjustInventory,
  createWebhook,
  listWebhooks,
};
