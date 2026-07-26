/**
 * Connecteur Shopify — premier représentant d'une famille, et rien de plus.
 *
 * ═════════════════════════════════════════════════════════════════════════════
 * CE QUE CE CONNECTEUR A COÛTÉ AU CŒUR DE MA ZONE : RIEN.
 * ═════════════════════════════════════════════════════════════════════════════
 *
 * C'est le seul résultat de l'étape 8 qui compte vraiment. Le CDM, les organes, l'Organe
 * d'Orchestration et l'API v1 n'ont pas bougé d'une ligne pour accueillir cet éditeur.
 * L'Integration Engine, lui, a gagné des mécanismes — coffre à secrets, connexion déléguée,
 * transport avec quotas, curseurs, réconciliation — et chacun a été écrit pour la FAMILLE :
 * Lightspeed, SumUp, Zettle, WooCommerce ou Sage les utiliseront tels quels.
 *
 * Ce qui est propre à Shopify tient dans quatre fichiers de ce dossier :
 *
 *   `api.js`       chemins d'URL, version d'API épinglée, en-tête de jeton, pagination
 *   `mapping.js`   variantes aplaties, `inventory_item_id` comme identité, HTML nettoyé
 *   `webhooks.js`  noms d'en-têtes, sujets d'abonnement, deux schémas de signature
 *   `index.js`     l'assemblage, ci-dessous
 *
 * Un contrôle d'intégration continue vérifie qu'aucun de ces mots ne se trouve ailleurs dans
 * `backend/src`. Ce n'est pas une précaution de style : c'est ce qui garantit que le
 * deuxième connecteur ne coûtera qu'un dossier.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * CAPACITÉS DÉCLARÉES : QUATRE, ET AUCUNE DE COMPLAISANCE
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Le contrat exige des capacités HONNÊTES, parce qu'une capacité annoncée engage Ma Zone
 * auprès du commerçant. Ce qui est déclaré ici est ce qui a été écrit :
 *
 *   `pull_catalog`    lire les produits et leurs déclinaisons
 *   `pull_inventory`  lire les niveaux de stock d'un établissement
 *   `push_sales`      signaler qu'une vente Ma Zone a fait partir de la marchandise
 *   `webhooks`        être prévenu d'un changement, avec preuve d'origine
 *
 * Ce qui n'est PAS déclaré, et qu'il serait facile de laisser croire : Ma Zone ne crée pas de
 * commande Shopify, ne touche pas aux clients, ne gère pas les remboursements. Voir
 * `mapping.js` pour la raison — elle est de fond, pas de calendrier.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * LE MODE `pos` EST EXERCÉ ICI POUR LA PREMIÈRE FOIS
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Un commerçant qui confie son stock à Shopify passe ses lignes en `inventory_owner = pos`.
 * À partir de là, et sans qu'une ligne d'organe change :
 *
 *   1. une vente Ma Zone baisse `reserved`, JAMAIS `on_hand` (étape 4, `commit`) ;
 *   2. ce connecteur signale le mouvement à Shopify par un ajustement relatif ;
 *   3. Shopify notifie son nouveau stock, que Ma Zone recopie dans `on_hand` (miroir).
 *
 * Aucun double décrément, et la vérité physique reste chez celui qui la détient. C'est la
 * matrice de propriété de l'étape 4 mise à l'épreuve d'un vrai éditeur — et le critère de
 * validation le plus important de cette étape.
 */

const registry = require('../../connectorRegistry');
const api = require('./api');
const mapping = require('./mapping');
const webhooks = require('./webhooks');
const { IntegrationError } = require('../../errors');

/**
 * Portées demandées, et pas une de plus.
 *
 * Un commerçant lit cette liste sur l'écran de consentement de Shopify, et il a raison de la
 * lire. Demander `write_products` « au cas où » afficherait « Ma Zone peut modifier vos
 * produits » à quelqu'un qui veut seulement synchroniser son stock : c'est le genre de
 * demande excessive qui fait abandonner une installation à la dernière seconde.
 *
 * `write_inventory` est la seule écriture demandée, et elle sert exactement à une chose :
 * dire qu'une unité est partie.
 */
const SCOPES = ['read_products', 'read_inventory', 'write_inventory', 'read_locations'];

// ── Connexion déléguée ────────────────────────────────────────────────────────

const oauth = {
  scopes: SCOPES,

  /**
   * Ce qu'on demande au commerçant avant de l'envoyer chez Shopify.
   *
   * Le domaine est indispensable : chez Shopify, l'URL d'autorisation est HÉBERGÉE PAR LA
   * BOUTIQUE elle-même. Le motif est vérifié par le moteur avant toute construction d'URL —
   * une valeur libre ici enverrait un flux d'autorisation vers un hôte choisi par l'appelant.
   */
  params: [{
    name: 'shop_domain',
    label: 'Adresse de votre boutique Shopify',
    placeholder: 'ma-boutique.myshopify.com',
    pattern: api.SHOP_DOMAIN.source,
    required: true,
  }],

  authorizeUrl({ app, params, redirectUri, state, scopes }) {
    const query = new URLSearchParams({
      client_id: app.client_id,
      scope: scopes.join(','),
      redirect_uri: redirectUri,
      state,
    });
    return `https://${api.assertShopDomain(params.shop_domain)}/admin/oauth/authorize?${query}`;
  },

  /** Vérification de la redirection : schéma hexadécimal sur les paramètres triés. */
  verifyCallback: webhooks.verifyCallback,

  tokenRequest({ app, code, params }) {
    return {
      method: 'POST',
      url: `https://${api.assertShopDomain(params.shop_domain)}/admin/oauth/access_token`,
      body: {
        client_id: app.client_id,
        client_secret: app.client_secret,
        code,
      },
    };
  },

  /**
   * Lecture de la réponse d'échange.
   *
   * Shopify délivre un jeton PERMANENT, sans échéance ni rafraîchissement. C'est pourquoi ce
   * descripteur ne déclare pas `refreshRequest` : écrire un chemin de renouvellement qui ne
   * serait jamais emprunté donnerait l'illusion d'une mécanique éprouvée.
   *
   * Le domaine est rangé dans la CONFIGURATION, pas dans le coffre : ce n'est pas un secret,
   * et c'est la clé par laquelle les notifications retrouveront la boutique.
   */
  parseToken(body, { params }) {
    if (!body?.access_token) {
      throw new IntegrationError('Shopify n\'a pas renvoyé de jeton d\'accès.', 502);
    }
    return {
      secrets: { access_token: body.access_token },
      config: { shop_domain: params.shop_domain },
      scopes: body.scope ? String(body.scope).split(',') : null,
    };
  },
};

// ── Contrat ───────────────────────────────────────────────────────────────────

/**
 * Test de connexion, appelé juste après le rangement du jeton.
 *
 * Il fait aussi une chose indispensable et facile à oublier : CHOISIR L'ÉTABLISSEMENT. Une
 * boutique Shopify a un ou plusieurs entrepôts, et lire un stock sans en désigner un
 * mélangerait les magasins. Le premier établissement actif est retenu par défaut, et le
 * commerçant pourra en changer — mais Ma Zone ne reste jamais sans réponse à « quel stock
 * est-ce que je lis ».
 */
async function authenticate(ctx) {
  const shop = await api.getShop(ctx);
  if (!shop) return { ok: false, reason: 'boutique introuvable avec ce jeton' };

  if (!ctx.config?.location_id) {
    const locations = await api.listLocations(ctx);
    const usable = locations.find((l) => l.active !== false);
    if (!usable) {
      return { ok: false, reason: 'aucun établissement actif dans cette boutique' };
    }
    // Écrit par le moteur : un connecteur ne touche pas la base (Loi 2).
    ctx.updateConfig?.({ location_id: String(usable.id), location_name: usable.name || null });
  }

  return { ok: true, account: shop.myshopify_domain || shop.domain || null };
}

/**
 * Abonnement aux notifications.
 *
 * IDEMPOTENT PAR LECTURE PRÉALABLE. Sans elle, chaque reconnexion empilerait un abonnement de
 * plus, et Shopify enverrait deux, puis trois notifications par changement. L'Inbox les
 * dédoublonnerait — la clé vient de l'éditeur — mais on aurait triplé le trafic pour rien, et
 * les quotas ne sont pas infinis.
 */
async function subscribeWebhooks(ctx) {
  const existing = await api.listWebhooks(ctx);
  const already = new Set(existing.map((hook) => `${hook.topic}|${hook.address}`));
  const created = [];

  for (const topic of [...webhooks.TOPIC_IDS, 'app/uninstalled']) {
    if (already.has(`${topic}|${ctx.webhookUrl}`)) continue;
    const hook = await api.createWebhook(ctx, { topic, address: ctx.webhookUrl });
    if (hook) created.push(topic);
  }

  return { subscribed: created, existing: existing.length };
}

/**
 * Lecture d'une page.
 *
 * Le curseur est celui de Shopify, rendu au moteur tel quel : il le garde sans le comprendre.
 * `nextCursor: null` signifie « fin de la lecture », et c'est ce qui arrête la boucle du
 * moteur.
 */
async function pull(resource, cursor, ctx) {
  if (resource === 'product') {
    const { products, nextCursor } = await api.listProducts(ctx, cursor);
    return {
      items: products.flatMap((product) => mapping.flattenProduct(product)),
      nextCursor,
    };
  }

  if (resource === 'inventory') {
    const { levels, nextCursor } = await api.listInventoryLevels(ctx, cursor);
    return { items: levels, nextCursor };
  }

  return { items: [], nextCursor: null };
}

/**
 * Envoi d'un mouvement.
 *
 * L'IDENTIFIANT EXTERNE EST DEMANDÉ AU MOTEUR, jamais deviné. Un connecteur qui lirait
 * `external_bindings` lui-même deviendrait un second lecteur d'une table qui n'est pas la
 * sienne ; `ctx.externalIdFor` est la question qu'il a le droit de poser.
 *
 * Une entité inconnue de Shopify n'est PAS une panne, et le distinguer est important : un
 * produit créé dans Ma Zone et jamais apparié n'existe pas chez l'éditeur. Réessayer six fois
 * ne le fera pas apparaître. On le dit, l'Outbox classe le message, et le commerçant peut le
 * lire dans son journal.
 */
async function push(resource, external, ctx) {
  const binding = ctx.externalIdFor({
    entityType: external.entityType,
    entityId: external.entityId,
  });

  if (!binding) {
    throw new IntegrationError(
      `« ${external.reference || external.entityId} » n'a pas d'équivalent connu dans cette `
      + 'boutique Shopify : importez le catalogue avant de synchroniser ses ventes.',
      422
    );
  }

  const locationId = binding.external_location_id || ctx.config?.location_id;
  if (!locationId) {
    throw new IntegrationError(
      'Aucun établissement Shopify connu pour cette boutique : reconnectez le logiciel.',
      409
    );
  }

  if (!external.delta) {
    // Rien à ajuster : un message à effet nul est livré sans appel réseau plutôt que refusé.
    return { externalRef: binding.external_id, delivered: 'no-op', resource };
  }

  const level = await api.adjustInventory(ctx, {
    inventoryItemId: binding.external_id,
    locationId,
    delta: external.delta,
  });

  return {
    externalRef: binding.external_id,
    externalLocationId: String(locationId),
    delivered: 'adjusted',
    resource,
    onHand: level?.available ?? null,
  };
}

const connector = registry.register({
  id: 'shopify',
  label: 'Shopify (boutique en ligne et caisse)',
  requiresAuth: true,
  secrets: ['access_token'],
  oauth,
  capabilities: ['pull_catalog', 'pull_inventory', 'push_sales', 'webhooks'],
  resources: ['product', 'inventory', 'order'],
  authenticate,
  subscribeWebhooks,
  pull,
  push,
  toCanonical: mapping.toCanonical,
  fromCanonical: mapping.fromCanonical,
  verifyWebhook: webhooks.verifyWebhook,
});

// Les extensions hors contrat restent visibles pour les tests, jamais pour le moteur : le
// registre ne retient que les méthodes du contrat, ce qui garantit qu'aucun moteur ne peut se
// mettre à dépendre d'une particularité de cet éditeur.
module.exports = { ...connector, api, mapping, webhooks, SCOPES };
