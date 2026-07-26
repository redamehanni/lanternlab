/**
 * API v1 — les projections, séparées par AUDIENCE.
 *
 * Une projection est une réponse mise en forme pour quelqu'un. Ce fichier existe parce
 * que « pour qui » est une question de sécurité, pas de présentation.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * LA RÈGLE : UNE RÉPONSE DESTINÉE À UN CLIENT NE CONTIENT JAMAIS `on_hand`.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Le stock physique d'une boutique est une information commerciale. Le savoir, c'est
 * connaître le rythme de vente, la taille des réassorts, la trésorerie immobilisée
 * — pour un concurrent, c'est gratuit et c'est précieux. Un client a besoin d'une
 * seule chose : combien il peut commander, c'est-à-dire `available`.
 *
 * DEUX FAÇONS DE TENIR CETTE RÈGLE, ET UNE SEULE QUI TIENT.
 *
 * La mauvaise : n'écrire que les bons champs, et compter sur la relecture. Elle échoue
 * toujours de la même manière — un jour on écrit `{ ...product }` pour aller vite,
 * `on_hand` n'est pas encore dans `products`, donc rien ne fuit, personne ne s'en
 * aperçoit ; six mois plus tard une jointure ajoute la colonne et la fuite est en
 * production sans qu'aucune ligne de la route n'ait changé.
 *
 * La bonne, celle d'ici : on ne part JAMAIS de la ligne de base. On construit l'objet
 * champ par champ depuis une liste blanche. Ce qui n'est pas nommé n'existe pas dans la
 * réponse, quoi qu'il arrive en amont. Et parce qu'une liste blanche peut elle-même
 * être mal écrite, `guard()` relit le résultat et refuse de répondre s'il porte un
 * champ interdit.
 *
 * LE GARDE ÉCHOUE EN 500, DÉLIBÉRÉMENT. Une fuite silencieuse est un incident qu'on
 * découvre par un tiers ; une route cassée est un incident qu'on découvre soi-même, en
 * dix secondes, avec le nom du champ coupable. Le second est préférable, même en
 * production. Il n'arrivera de toute façon jamais en production : le test de contrat
 * balaie toutes les routes client à chaque exécution de la suite.
 */

/**
 * Champs de GESTION DE STOCK. Interdits dans toute réponse client, à toute profondeur,
 * sans exception et sans contexte atténuant.
 *
 * Ces quatre noms ne veulent dire qu'une chose : l'état interne du stock d'une boutique.
 * Aucun d'eux n'a de second sens légitime, ce qui les rend balayables mécaniquement.
 */
const MANAGEMENT_STOCK_FIELDS = ['on_hand', 'reserved', 'safety_buffer', 'inventory_owner'];

/**
 * Champs interdits dans une projection de CATALOGUE, où `quantity` s'ajoute à la liste.
 *
 * LA DISTINCTION AVEC LA LISTE PRÉCÉDENTE A ÉTÉ APPRISE PAR UN TEST QUI ÉCHOUE. Le
 * premier balayage interdisait `quantity` partout, et il a signalé une fuite dans
 * `GET /api/v1/intents` : une intention déclare un paramètre nommé `quantity`, qui est la
 * quantité COMMANDÉE. Aucune fuite, donc — mais une règle trop grossière, et une règle
 * trop grossière finit toujours par être désactivée « parce qu'elle crie pour rien ».
 *
 * La vérité est contextuelle : sur un produit, `quantity` serait un second nom du
 * vendable, et garder deux noms pour la même valeur recréerait dans la surface neuve
 * l'ambiguïté que l'étape 4 a mis un mois à dissiper. Sur une commande ou un paramètre
 * d'intention, `quantity` est un nombre d'articles demandés, et il est parfaitement à sa
 * place.
 */
const CLIENT_FORBIDDEN = [...MANAGEMENT_STOCK_FIELDS, 'quantity'];

const AUDIENCE = {
  /** Acheteur. Ne voit que ce qu'il peut commander. */
  CLIENT: 'client',
  /** Équipe d'une boutique. Voit son propre stock, en entier. */
  STORE: 'store',
  /** Livreur. Voit une course, pas un catalogue. */
  DRIVER: 'driver',
};

/**
 * Construit un objet à partir d'une liste blanche.
 *
 * Un champ absent de la source vaut `null` et non `undefined` : `JSON.stringify` efface
 * les `undefined`, et une clé qui apparaît ou disparaît selon les données fait mentir le
 * contrat. Un client qui lit `product.category` doit trouver `null`, pas une exception.
 */
function pick(source, fields) {
  const out = {};
  for (const field of fields) out[field] = source?.[field] ?? null;
  return out;
}

/**
 * Relit une réponse client et refuse tout champ interdit, à toute profondeur.
 *
 * Récursif parce que la fuite arrive presque toujours par un objet imbriqué — un
 * `store` enrichi, une `promotion` construite ailleurs, un tableau de produits.
 */
function guard(payload, path = 'réponse') {
  if (payload === null || typeof payload !== 'object') return payload;

  if (Array.isArray(payload)) {
    payload.forEach((item, index) => guard(item, `${path}[${index}]`));
    return payload;
  }

  for (const key of Object.keys(payload)) {
    if (CLIENT_FORBIDDEN.includes(key)) {
      const err = new Error(
        `[API v1] fuite de projection : « ${key} » dans ${path}. `
        + 'Le stock physique d\'une boutique n\'appartient pas à l\'acheteur — '
        + 'voir routes/v1/projections.js.'
      );
      err.status = 500;
      throw err;
    }
    guard(payload[key], `${path}.${key}`);
  }
  return payload;
}

// ── Catalogue — audience CLIENT ───────────────────────────────────────────────

const PRODUCT_CLIENT_FIELDS = [
  'id', 'store_id', 'name', 'description', 'price', 'category', 'image_url', 'barcode',
];

/**
 * Fiche produit pour un acheteur.
 *
 * `available` est passé par l'appelant plutôt que lu ici : c'est l'organe Inventory qui
 * le calcule, et une projection qui interrogerait elle-même la base deviendrait un
 * second chemin de lecture du stock. Il n'en existe qu'un.
 */
function productForClient(row, { available, promotion = null }) {
  return guard({
    ...pick(row, PRODUCT_CLIENT_FIELDS),
    available,
    active: !!row.active,
    promotion: promotion ? promotionForClient(promotion) : null,
  }, 'produit');
}

/**
 * Promotion telle qu'un client la voit.
 *
 * `remaining_quantity` est absent volontairement : c'est un compteur de gestion, et
 * l'afficher inviterait à déduire le rythme des ventes. Ce qui intéresse l'acheteur est
 * le prix et l'étiquette.
 */
function promotionForClient(promo) {
  return {
    id: promo.id ?? null,
    type: promo.type ?? null,
    label: promo.promo_label ?? null,
    price: promo.type === 'discount' ? (promo.promo_price ?? null) : null,
    original_price: promo.original_price ?? null,
    discount_percent: promo.saved_percent ?? promo.discount_percent ?? null,
    buy_quantity: promo.buy_quantity ?? null,
    get_quantity: promo.get_quantity ?? null,
    ends_at: promo.ends_at ?? null,
  };
}

const STORE_FIELDS = [
  'id', 'name', 'address', 'description', 'category', 'phone', 'image_url', 'lat', 'lng',
];

/** Boutique. Même forme pour toutes les audiences : rien n'y est confidentiel. */
function storeForAnyone(row, { distanceKm = null } = {}) {
  return guard({
    ...pick(row, STORE_FIELDS),
    distance_km: distanceKm,
  }, 'boutique');
}

// ── Inventaire — audience BOUTIQUE uniquement ─────────────────────────────────

/**
 * État de stock complet. Ne doit jamais quitter une route qui vérifie l'appartenance
 * à la boutique.
 *
 * Cette fonction n'appelle PAS `guard` : elle est faite pour exposer précisément ce que
 * `guard` interdit. C'est la seule exception du fichier, et elle est nommée pour qu'on
 * ne l'utilise pas par distraction.
 */
function stockForStore(level) {
  return {
    product_id: level.product_id,
    variant_id: level.variant_id ?? null,
    on_hand: level.on_hand,
    reserved: level.reserved,
    safety_buffer: level.safety_buffer,
    available: level.available,
    inventory_owner: level.inventory_owner,
    updated_at: level.updated_at ?? null,
  };
}

/** Un mouvement de stock, tel que le journal l'a écrit. */
function movementForStore(movement) {
  return {
    id: movement.id,
    product_id: movement.product_id,
    kind: movement.kind,
    quantity: movement.quantity,
    reason: movement.reason ?? null,
    origin: movement.origin,
    reference: movement.reference ?? null,
    on_hand_after: movement.on_hand_after,
    reserved_after: movement.reserved_after,
    occurred_at: movement.occurred_at,
  };
}

// ── Commandes et livraisons ──────────────────────────────────────────────────

const ORDER_FIELDS = [
  'id', 'client_id', 'store_id', 'product_id', 'quantity', 'total_price', 'status',
  'delivery_address', 'estimated_minutes', 'created_at', 'updated_at',
];

/**
 * Commande, pour une partie prenante.
 *
 * `quantity` est ici la quantité COMMANDÉE, pas un stock : c'est le seul endroit de
 * `/api/v1` où ce mot est légitime. Le garde client n'est donc pas appliqué — il
 * refuserait un champ qui ne dit rien du stock de la boutique. La distinction est
 * subtile et c'est précisément pour cela qu'elle est écrite ici plutôt que devinée.
 */
function orderForParty(row) {
  return {
    ...pick(row, ORDER_FIELDS),
    store: row.store_name ? { id: row.store_id, name: row.store_name, address: row.store_address ?? null } : null,
    product: row.product_name ? { id: row.product_id, name: row.product_name, image_url: row.product_image ?? null } : null,
  };
}

/** Course, pour le livreur qui l'exécute. */
function deliveryForDriver(row) {
  return {
    id: row.id,
    order_id: row.order_id,
    status: row.status,
    accepted_at: row.accepted_at ?? null,
    created_at: row.created_at,
    pickup: row.store_name
      ? { store_id: row.store_id, name: row.store_name, address: row.store_address ?? null }
      : null,
    dropoff: { address: row.delivery_address ?? null },
    earnings: row.commission ?? null,
  };
}

module.exports = {
  AUDIENCE,
  CLIENT_FORBIDDEN,
  MANAGEMENT_STOCK_FIELDS,
  pick,
  guard,
  productForClient,
  promotionForClient,
  storeForAnyone,
  stockForStore,
  movementForStore,
  orderForParty,
  deliveryForDriver,
};
