/**
 * CDM — matrice de propriété des attributs.
 *
 * LOI 3 : chaque attribut a un propriétaire nommé, et la propriété se déclare au
 * niveau de l'ATTRIBUT, pas de l'entité. Sans cette précision la loi est
 * inapplicable : `on_hand` et `reserved` du même produit ont deux propriétaires
 * différents, et aucune règle au niveau « Product » ne peut exprimer cela.
 *
 * Trois rôles, et trois seulement :
 *
 *   owner       Ma Zone décide de la valeur. Un logiciel tiers qui propose une
 *               autre valeur est en conflit, et c'est Ma Zone qui gagne.
 *   mirror      Un système externe décide. Ma Zone recopie sans jamais décider.
 *               Une écriture locale sur un miroir est un bug.
 *   calculated  La valeur se déduit d'autres attributs. Toute écriture directe est
 *               REJETÉE (Loi 11).
 *
 * Un attribut peut avoir un rôle qui dépend du mode d'inventaire : `on_hand` est
 * propriété de Ma Zone quand le commerçant n'a pas de caisse (`mazone`), et miroir
 * de la caisse quand il en a une (`pos`). C'est exprimé par `byMode`.
 */

const ROLES = ['owner', 'mirror', 'calculated'];
const INVENTORY_MODES = ['mazone', 'pos'];

/**
 * `<Entité>.<attribut>` → rôle.
 *
 * Toute entrée manquante fait ÉCHOUER le démarrage (voir `index.js`) : un attribut
 * sans propriétaire déclaré est exactement le genre d'oubli qui produit une
 * survente six mois plus tard.
 */
const OWNERSHIP = {
  // ── Personnes et boutiques : Ma Zone est le système de référence ────────────
  // Un connecteur peut proposer une fiche client ou une fiche boutique, mais
  // l'identité Ma Zone reste décidée par Ma Zone.

  'Person.*': 'owner',
  'Store.*': 'owner',

  // ── Catalogue ──────────────────────────────────────────────────────────────
  // Le catalogue est le premier candidat au miroir : quand un commerçant tient
  // ses fiches produit dans son e-commerce, Ma Zone les recopie. Le mode se
  // décide par boutique à l'étape 6 ; en attendant, Ma Zone est propriétaire.

  'Product.id': 'owner',
  'Product.store_id': 'owner',
  'Product.name': 'owner',
  'Product.description': 'owner',
  'Product.price': 'owner',
  // `quantity` devient une projection de `available` à l'étape 4 : dès
  // aujourd'hui il est déclaré calculé, pour qu'aucun nouveau code ne prenne
  // l'habitude de l'écrire directement.
  'Product.quantity': { role: 'calculated', from: 'StockLevel.available', since: 'E4' },
  'Product.category': 'owner',
  'Product.barcode': 'owner',
  'Product.active': 'owner',
  'Product.created_at': 'owner',

  'Variant.*': 'owner',

  // ── Stock : le cœur de la matrice ──────────────────────────────────────────

  'StockLevel.id': 'owner',
  'StockLevel.product_id': 'owner',
  'StockLevel.variant_id': 'owner',
  // Stock physique : la caisse le connaît mieux que nous quand il y en a une.
  'StockLevel.on_hand': { byMode: { mazone: 'owner', pos: 'mirror' } },
  // Réservations : TOUJOURS Ma Zone. Aucune caisse ne sait ce que Ma Zone a
  // promis à un client. C'est l'invariant qui empêche le double décrément.
  'StockLevel.reserved': 'owner',
  // Politique commerciale du magasin dans Ma Zone.
  'StockLevel.safety_buffer': 'owner',
  'StockLevel.inventory_owner': 'owner',
  'StockLevel.updated_at': 'owner',
  // Dérivé, donc jamais écrit.
  'StockLevel.available': { role: 'calculated', from: 'on_hand - reserved - safety_buffer' },

  'StockMovement.*': 'owner',

  // ── Vente et livraison : Ma Zone décide, toujours ──────────────────────────
  // Une caisse peut être informée d'une vente Ma Zone, elle ne la décide jamais.

  'Order.*': 'owner',
  'Delivery.*': 'owner',

  // ── Frontière externe ──────────────────────────────────────────────────────
  // La correspondance d'identifiants appartient à Ma Zone même si l'un des deux
  // identifiants vient d'ailleurs.

  'ExternalBinding.id': 'owner',
  'ExternalBinding.connector_id': 'owner',
  'ExternalBinding.mazone_entity_type': 'owner',
  'ExternalBinding.mazone_id': 'owner',
  // Les deux seuls miroirs de la table : ce que l'éditeur nous dit de lui-même. Tout le
  // reste — le fait d'associer, quand, avec quoi — est une décision de Ma Zone.
  'ExternalBinding.external_id': 'mirror',
  'ExternalBinding.external_location_id': 'mirror',
  // Horodatage produit par la source : nous ne le fabriquons pas, nous le conservons pour
  // pouvoir refuser un message en retard.
  'ExternalBinding.last_source_updated_at': 'mirror',
  'ExternalBinding.last_synced_at': 'owner',
  'ExternalBinding.created_at': 'owner',

  // Un conflit est une observation de Ma Zone SUR une proposition externe. L'observation
  // nous appartient entièrement — y compris le fait de dire quelle valeur avait été
  // proposée. Seul l'horodatage de la source est un miroir.
  'SyncConflict.id': 'owner',
  'SyncConflict.connector_id': 'owner',
  'SyncConflict.store_id': 'owner',
  'SyncConflict.mazone_entity_type': 'owner',
  'SyncConflict.mazone_id': 'owner',
  'SyncConflict.external_id': 'mirror',
  'SyncConflict.attribute': 'owner',
  'SyncConflict.proposed_value': 'owner',
  'SyncConflict.retained_value': 'owner',
  'SyncConflict.losing_source': 'owner',
  'SyncConflict.reason': 'owner',
  'SyncConflict.payload_summary': 'owner',
  'SyncConflict.source_updated_at': 'mirror',
  'SyncConflict.acknowledged_at': 'owner',
  'SyncConflict.created_at': 'owner',
};

/** Normalise une déclaration abrégée (`'owner'`) en objet. */
function normalize(declaration) {
  if (typeof declaration === 'string') return { role: declaration };
  return declaration;
}

/**
 * Rôle d'un attribut, éventuellement dépendant du mode d'inventaire.
 *
 * @param {string} entity nom canonique de l'entité
 * @param {string} attribute nom de l'attribut
 * @param {{ inventoryOwner?: 'mazone'|'pos' }} context
 * @returns {'owner'|'mirror'|'calculated'|null} `null` si non déclaré
 */
function roleOf(entity, attribute, { inventoryOwner = 'mazone' } = {}) {
  const declaration = OWNERSHIP[`${entity}.${attribute}`] ?? OWNERSHIP[`${entity}.*`];
  if (!declaration) return null;

  const normalized = normalize(declaration);
  if (normalized.byMode) return normalized.byMode[inventoryOwner] ?? null;
  return normalized.role ?? null;
}

/** Un attribut calculé ne peut jamais être écrit (Loi 11). */
function isWritable(entity, attribute, context) {
  return roleOf(entity, attribute, context) === 'owner';
}

/** Un miroir est écrit par le connecteur, jamais par un organe métier. */
function isMirror(entity, attribute, context) {
  return roleOf(entity, attribute, context) === 'mirror';
}

function isCalculated(entity, attribute, context) {
  return roleOf(entity, attribute, context) === 'calculated';
}

module.exports = {
  ROLES,
  INVENTORY_MODES,
  OWNERSHIP,
  roleOf,
  isWritable,
  isMirror,
  isCalculated,
  normalize,
};
