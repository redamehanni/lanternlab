/**
 * Integration Engine — correspondances entre entités Ma Zone et entités externes.
 *
 * LOI 16 — CETTE TABLE EST LE SEUL ENDROIT DU SYSTÈME OÙ VIT UN IDENTIFIANT EXTERNE.
 *
 * Nulle part ailleurs : ni dans `products`, ni dans `orders`, ni dans `stock_levels`, ni
 * dans le CDM. C'est une contrainte inconfortable — une colonne `shopify_id` sur
 * `products` serait tellement plus simple à écrire — et c'est précisément pour cela
 * qu'elle doit être défendue.
 *
 * Ce qu'une colonne `shopify_id` coûterait vraiment. Elle ne coûte rien le premier jour.
 * Elle coûte au douzième connecteur, quand la table `products` porte douze colonnes
 * mortes pour la plupart des boutiques. Elle coûte le jour où un commerçant utilise deux
 * logiciels. Elle coûte surtout le jour où Ma Zone veut remplacer un de ces logiciels
 * par son propre organe : il faut alors migrer un schéma métier pour une raison qui n'a
 * rien de métier. Une table de correspondance se vide ; une colonne se migre.
 *
 * `last_source_updated_at` porte l'horodatage de la SOURCE, pas le nôtre. C'est ce qui
 * permet de reconnaître un message en retard — un webhook rejoué après une correction
 * plus récente — et de le refuser au lieu de revenir en arrière (`stale_timestamp`).
 */

const db = require('../../db');
const { IntegrationError } = require('./errors');

/** Types d'entités Ma Zone pouvant porter une correspondance externe. */
const ENTITY_TYPE = {
  PRODUCT: 'product',
  ORDER: 'order',
  CUSTOMER: 'customer',
  STORE: 'store',
};

const ENTITY_TYPES = Object.values(ENTITY_TYPE);

db.exec(`
  CREATE TABLE IF NOT EXISTS external_bindings (
    id TEXT PRIMARY KEY,
    mazone_entity_type TEXT NOT NULL,
    mazone_id TEXT NOT NULL,
    connector_id TEXT NOT NULL,
    external_id TEXT NOT NULL,
    -- Multi-outlet : un même produit peut exister dans deux magasins d'un même
    -- éditeur, avec deux stocks distincts. Sans cette colonne, le second écraserait
    -- le premier en silence.
    external_location_id TEXT,
    last_source_updated_at TEXT,
    last_synced_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),

    -- Deux unicités, et les deux comptent :
    -- une entité Ma Zone n'a qu'une correspondance par connecteur et par outlet…
    UNIQUE (mazone_entity_type, mazone_id, connector_id, external_location_id),
    -- …et une entité externe ne correspond qu'à une entité Ma Zone. Sans cette
    -- seconde contrainte, deux produits Ma Zone pourraient pointer le même produit
    -- externe et se voler mutuellement leur stock.
    UNIQUE (connector_id, external_id, external_location_id, mazone_entity_type)
  );

  CREATE INDEX IF NOT EXISTS idx_bindings_mazone
    ON external_bindings(mazone_entity_type, mazone_id);
  CREATE INDEX IF NOT EXISTS idx_bindings_external
    ON external_bindings(connector_id, external_id);
`);

function assertKnownEntity(type) {
  if (!ENTITY_TYPES.includes(type)) {
    throw new IntegrationError(
      `Type d'entité inconnu « ${type} » — connus : ${ENTITY_TYPES.join(', ')}.`,
      400
    );
  }
}

/**
 * Crée ou met à jour une correspondance.
 *
 * Le remappage d'une entité Ma Zone vers un autre identifiant externe est REFUSÉ. Ce
 * n'est jamais une opération anodine : c'est soit une erreur de mapping, soit une
 * décision qui mérite d'être vue. Un auto-merge silencieux, ici, fait fusionner deux
 * produits distincts et rend le stock des deux faux — sans une ligne de log.
 */
function bind({
  entityType, mazoneId, connectorId, externalId,
  externalLocationId = null, sourceUpdatedAt = null,
}) {
  assertKnownEntity(entityType);
  if (!mazoneId || !connectorId || !externalId) {
    throw new IntegrationError('Correspondance incomplète.', 400);
  }

  const existing = find({ entityType, mazoneId, connectorId, externalLocationId });

  if (existing && existing.external_id !== externalId) {
    throw new IntegrationError(
      `Cette entité est déjà associée à « ${existing.external_id} » chez ce connecteur. `
      + 'Un remappage doit être explicite : détachez d\'abord la correspondance existante.',
      409
    );
  }

  if (existing) {
    db.prepare(`
      UPDATE external_bindings
      SET last_source_updated_at = COALESCE(?, last_source_updated_at),
          last_synced_at = datetime('now')
      WHERE id = ?
    `).run(sourceUpdatedAt, existing.id);
    return find({ entityType, mazoneId, connectorId, externalLocationId });
  }

  const id = db.generateId();
  db.prepare(`
    INSERT INTO external_bindings
      (id, mazone_entity_type, mazone_id, connector_id, external_id,
       external_location_id, last_source_updated_at, last_synced_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `).run(id, entityType, mazoneId, connectorId, externalId, externalLocationId, sourceUpdatedAt);

  return find({ entityType, mazoneId, connectorId, externalLocationId });
}

/** Détache une correspondance. Opération explicite, jamais un effet de bord. */
function unbind({ entityType, mazoneId, connectorId, externalLocationId = null }) {
  const info = db.prepare(`
    DELETE FROM external_bindings
    WHERE mazone_entity_type = ? AND mazone_id = ? AND connector_id = ?
      AND external_location_id IS ?
  `).run(entityType, mazoneId, connectorId, externalLocationId);
  return info.changes > 0;
}

function find({ entityType, mazoneId, connectorId, externalLocationId = null }) {
  const row = db.prepare(`
    SELECT * FROM external_bindings
    WHERE mazone_entity_type = ? AND mazone_id = ? AND connector_id = ?
      AND external_location_id IS ?
  `).get(entityType, mazoneId, connectorId, externalLocationId);
  return row || null;
}

/** Traduction inverse : de l'identifiant externe vers l'entité Ma Zone. */
function resolve({ connectorId, externalId, entityType, externalLocationId = null }) {
  assertKnownEntity(entityType);
  const row = db.prepare(`
    SELECT * FROM external_bindings
    WHERE connector_id = ? AND external_id = ? AND mazone_entity_type = ?
      AND external_location_id IS ?
  `).get(connectorId, externalId, entityType, externalLocationId);
  return row || null;
}

/**
 * Traduction inverse pour un message QUI PARLE D'UN ÉTABLISSEMENT.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POURQUOI CETTE SECONDE FONCTION EXISTE, ET POURQUOI ELLE EST DE FAMILLE
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Les catalogues et les stocks ne parlent pas de la même chose chez à peu près tous les
 * éditeurs du marché. UN CATALOGUE DÉCRIT UN ARTICLE, sans magasin : c'est une fiche. UN
 * NIVEAU DE STOCK DÉCRIT UN ARTICLE DANS UN MAGASIN. La conséquence est mécanique et n'a
 * rien de propre à un éditeur : une correspondance créée en important un catalogue ne porte
 * pas d'établissement, alors que le message de stock qui la cherche en porte un.
 *
 * Avec une résolution strictement exacte, chaque notification de stock serait refusée en
 * `unmapped_entity` juste après un import réussi. Le commerçant verrait un catalogue
 * parfait, un journal de conflits qui se remplit, et un stock immobile — la panne la plus
 * difficile à diagnostiquer de tout le moteur, parce que rien n'a « échoué ».
 *
 * La règle retenue, dans cet ordre :
 *
 *   1. la correspondance de CET établissement, si elle existe — un commerçant qui tient
 *      deux magasins chez le même éditeur a deux stocks, et ils ne doivent pas se mélanger ;
 *   2. à défaut, la correspondance SANS établissement — « cet article, où qu'il soit ».
 *
 * Jamais l'inverse, et jamais la correspondance d'un AUTRE établissement : ce serait faire
 * écrire le stock du magasin de la gare par celui du centre-ville.
 */
function resolveForOutlet({ connectorId, externalId, entityType, externalLocationId = null }) {
  const exact = resolve({ connectorId, externalId, entityType, externalLocationId });
  if (exact || externalLocationId === null) return exact;

  return resolve({ connectorId, externalId, entityType, externalLocationId: null });
}

/**
 * Le message est-il plus récent que ce qui a déjà été appliqué ?
 *
 * Sans cette question, un webhook rejoué (les éditeurs en rejouent) réappliquerait un
 * état ancien par-dessus un état récent. Le stock reculerait sans que personne ne
 * comprenne pourquoi.
 *
 * En l'absence d'horodatage source, on accepte : refuser par principe rendrait
 * inutilisables les connecteurs qui n'en fournissent pas, et un import CSV n'a pas
 * d'horloge.
 */
function isFresh(binding, sourceUpdatedAt) {
  if (!binding || !binding.last_source_updated_at || !sourceUpdatedAt) return true;
  return String(sourceUpdatedAt) >= String(binding.last_source_updated_at);
}

/** Toutes les correspondances d'une entité, tous connecteurs confondus. */
function forEntity(entityType, mazoneId) {
  return db.prepare(`
    SELECT * FROM external_bindings WHERE mazone_entity_type = ? AND mazone_id = ?
  `).all(entityType, mazoneId);
}

module.exports = {
  ENTITY_TYPE,
  ENTITY_TYPES,
  bind,
  unbind,
  find,
  resolve,
  resolveForOutlet,
  isFresh,
  forEntity,
};
