/**
 * Connecteur Shopify — notifications temps réel.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * CE FICHIER PROUVE UNE ORIGINE. IL NE FAIT RIEN D'AUTRE.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Une route de webhook est publique par nature : son URL finit par se retrouver dans des
 * journaux, des captures d'écran, des tickets de support. Sans preuve d'origine, n'importe
 * qui pourrait déclarer le stock de n'importe quelle boutique — et le déclarer à zéro
 * suffirait à empêcher un commerçant de vendre.
 *
 * Le schéma de signature est propre à Shopify (nom de l'en-tête, algorithme, encodage) ; la
 * comparaison à temps constant, elle, appartient au moteur (`signature.js`). Le partage est
 * exactement celui-là, et il n'est pas négociable : personne ne doit réécrire un
 * `timingSafeEqual` dans un connecteur.
 */

const signature = require('../../signature');

/**
 * En-têtes de Shopify.
 *
 * `X-Shopify-Webhook-Id` est ce qui rend une notification rejouée reconnaissable. Shopify
 * REJOUE — après une panne de notre côté, après un délai de réponse trop long, parfois sans
 * raison visible. Fabriquer une clé d'idempotence de notre côté (un hachage du corps, par
 * exemple) confondrait deux changements successifs revenant à la même valeur avec un doublon.
 */
const HEADER = {
  SIGNATURE: 'X-Shopify-Hmac-Sha256',
  SHOP_DOMAIN: 'X-Shopify-Shop-Domain',
  TOPIC: 'X-Shopify-Topic',
  EVENT_ID: 'X-Shopify-Webhook-Id',
};

/**
 * Sujets suivis, et la ressource canonique de chacun.
 *
 * Table déclarative : ajouter un sujet est une ligne, et le moteur n'a pas à connaître le
 * vocabulaire d'événements de Shopify. `app/uninstalled` est présent parce que son absence
 * est un piège classique — un commerçant qui désinstalle l'application depuis Shopify laisse
 * sinon Ma Zone appeler une API qui refusera son jeton pour toujours, en réessayant.
 */
const TOPICS = {
  'inventory_levels/update': { resource: 'inventory' },
  'products/update': { resource: 'product' },
  'products/create': { resource: 'product' },
  'app/uninstalled': { resource: null, uninstall: true },
};

const TOPIC_IDS = Object.keys(TOPICS).filter((topic) => !TOPICS[topic].uninstall);

/**
 * Vérifie une notification et dit ce qu'elle contient.
 *
 * @param {object} params
 * @param {object} params.headers
 * @param {Buffer} params.rawBody         corps BRUT, indispensable (voir `signature.js`)
 * @param {object} params.payload
 * @param {object} params.app             identifiants de l'application Ma Zone chez Shopify
 * @param {Function} params.resolveStore  (clé, valeur) → boutique Ma Zone, fourni par le moteur
 * @returns {{ valid: boolean }|object}
 */
function verifyWebhook({ headers = {}, rawBody = null, payload = null, app = null, resolveStore = null }) {
  const provided = signature.header(headers, HEADER.SIGNATURE);
  const secret = app?.client_secret;

  // Refus AVANT toute lecture de la charge. Un contrôle de signature placé après une lecture
  // de contenu est un contrôle qu'on a déjà contourné.
  if (!signature.verifyHmac({ payload: rawBody, provided, secret })) {
    return { valid: false };
  }

  const topic = signature.header(headers, HEADER.TOPIC);
  const spec = TOPICS[topic];
  if (!spec) {
    // Signature valide mais sujet non suivi : ce n'est pas une attaque, c'est un abonnement
    // qu'on n'exploite pas. Le dire évite de remplir l'Inbox de messages qu'aucun chemin ne
    // traitera.
    return { valid: false, reason: `sujet non suivi « ${topic} »` };
  }

  const shopDomain = signature.header(headers, HEADER.SHOP_DOMAIN);
  // La boutique Ma Zone est retrouvée par le SEUL identifiant que Shopify connaisse d'elle :
  // son domaine. Le moteur fait la recherche, le connecteur dit seulement où regarder.
  const installation = resolveStore ? resolveStore('shop_domain', shopDomain) : null;

  if (spec.uninstall) {
    return {
      valid: true,
      uninstalled: true,
      storeId: installation?.store_id ?? null,
      resource: 'inventory',
      payload,
      idempotencyKey: `shopify:uninstall:${shopDomain}:${signature.header(headers, HEADER.EVENT_ID)}`,
    };
  }

  return {
    valid: true,
    storeId: installation?.store_id ?? null,
    resource: spec.resource,
    payload,
    // Clé donnée par l'ÉDITEUR : c'est ce qui rend un rejeu reconnaissable comme doublon.
    idempotencyKey: `shopify:${signature.header(headers, HEADER.EVENT_ID) || `${topic}:${Date.now()}`}`,
    sourceUpdatedAt: payload?.updated_at || null,
  };
}

/**
 * Vérifie la redirection d'autorisation.
 *
 * Schéma différent de celui des webhooks, chez le même éditeur : ici l'empreinte est
 * hexadécimale et porte sur les paramètres de la requête triés, hors `hmac`. C'est
 * précisément le genre de particularité qui doit rester dans un connecteur — un moteur qui
 * l'absorberait aurait un « mode de vérification » de plus à chaque éditeur.
 */
function verifyCallback({ query = {}, app = null }) {
  const provided = query.hmac;
  if (!provided || !app?.client_secret) return false;

  const message = Object.keys(query)
    .filter((key) => key !== 'hmac' && key !== 'signature')
    .sort()
    .map((key) => `${key}=${query[key]}`)
    .join('&');

  // Comparaison déléguée : même primitive à temps constant que pour les webhooks.
  return signature.verifyHmac({
    payload: message, provided, secret: app.client_secret, encoding: 'hex',
  });
}

module.exports = { HEADER, TOPICS, TOPIC_IDS, verifyWebhook, verifyCallback };
