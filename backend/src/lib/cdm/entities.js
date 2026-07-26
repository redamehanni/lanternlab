/**
 * CDM — dictionnaire des entités métier de Ma Zone.
 *
 * LOI 4 : le CDM est un VOCABULAIRE, pas un magasin. Ce fichier ne contient
 * aucune donnée, aucun accès base, aucun comportement. Il dit comment les choses
 * s'appellent, de quel type elles sont, et lesquelles sont obligatoires. Il ne dit
 * jamais où elles sont rangées ni comment on les calcule.
 *
 * Deux statuts cohabitent volontairement :
 *   - `live`    : l'entité existe en base aujourd'hui. Le CDM décrit le schéma
 *                 RÉEL, `products.quantity` compris. On documente l'existant avant
 *                 de proposer la cible.
 *   - `planned` : l'entité arrive à une étape ultérieure de la roadmap. Elle est
 *                 déclarée pour que la matrice de propriété soit complète, mais
 *                 aucune table n'est attendue tant que l'étape n'est pas faite.
 */

const ENTITIES = {
  // ── Acteurs ────────────────────────────────────────────────────────────────

  Person: {
    status: 'live',
    table: 'users',
    description: 'Citoyen Ma Zone. Un seul compte, plusieurs rôles possibles.',
    fields: {
      id: { type: 'id', required: true },
      name: { type: 'string', required: true },
      email: { type: 'string', required: true },
      phone: { type: 'string' },
      role: { type: 'enum', values: ['client', 'merchant', 'driver'], required: true },
      address: { type: 'string' },
      lat: { type: 'number' },
      lng: { type: 'number' },
      created_at: { type: 'timestamp' },
    },
  },

  Store: {
    status: 'live',
    table: 'stores',
    description: 'Point de vente d\'un commerçant.',
    fields: {
      id: { type: 'id', required: true },
      merchant_id: { type: 'id', required: true, references: 'Person' },
      name: { type: 'string', required: true },
      address: { type: 'string', required: true },
      description: { type: 'text' },
      category: { type: 'string' },
      phone: { type: 'string' },
      email: { type: 'string' },
      lat: { type: 'number' },
      lng: { type: 'number' },
      created_at: { type: 'timestamp' },
    },
  },

  // ── Catalogue ──────────────────────────────────────────────────────────────

  Product: {
    status: 'live',
    table: 'products',
    description: 'Article vendu par une boutique.',
    fields: {
      id: { type: 'id', required: true },
      store_id: { type: 'id', required: true, references: 'Store' },
      name: { type: 'string', required: true },
      description: { type: 'text' },
      price: { type: 'money', required: true },
      // Compteur unique historique. Devient une PROJECTION de `available` à
      // l'étape 4 : le mobile continue de le lire sans être modifié.
      quantity: { type: 'integer', required: true, legacy: true },
      category: { type: 'string' },
      barcode: { type: 'string' },
      active: { type: 'boolean', required: true },
      created_at: { type: 'timestamp' },
    },
  },

  Variant: {
    status: 'planned',
    since: 'E4',
    table: 'product_variants',
    description:
      'Déclinaison vendable d\'un produit (taille, couleur). Le stock se tient au '
      + 'niveau de la déclinaison, pas du produit.',
    fields: {
      id: { type: 'id', required: true },
      product_id: { type: 'id', required: true, references: 'Product' },
      sku: { type: 'string' },
      label: { type: 'string' },
      price: { type: 'money' },
      created_at: { type: 'timestamp' },
    },
  },

  // ── Stock ──────────────────────────────────────────────────────────────────

  StockLevel: {
    status: 'live',
    since: 'E4',
    table: 'stock_levels',
    description:
      'État de stock à triple valeur. `available` n\'est jamais stocké comme '
      + 'vérité : il se calcule (Loi 11).',
    fields: {
      id: { type: 'id', required: true },
      product_id: { type: 'id', required: true, references: 'Product' },
      variant_id: { type: 'id', references: 'Variant' },
      on_hand: { type: 'integer', required: true },
      reserved: { type: 'integer', required: true },
      safety_buffer: { type: 'integer', required: true },
      inventory_owner: { type: 'enum', values: ['mazone', 'pos'], required: true },
      updated_at: { type: 'timestamp' },
    },
    // Attributs dérivés : exposés par le CDM, jamais persistés comme source.
    computed: {
      available: {
        type: 'integer',
        from: ['on_hand', 'reserved', 'safety_buffer'],
        formula: 'on_hand - reserved - safety_buffer',
      },
    },
  },

  StockMovement: {
    status: 'live',
    since: 'E4',
    table: 'stock_movements',
    description: 'Journal append-only des mouvements de stock (Loi 9).',
    fields: {
      id: { type: 'id', required: true },
      product_id: { type: 'id', required: true, references: 'Product' },
      variant_id: { type: 'id', references: 'Variant' },
      kind: {
        type: 'enum',
        values: ['reserve', 'release', 'commit', 'adjust', 'sync_on_hand'],
        required: true,
      },
      quantity: { type: 'integer', required: true },
      reason: { type: 'string' },
      origin: { type: 'enum', values: ['mazone', 'connector', 'merchant'], required: true },
      // Rattachement métier du mouvement : la commande, l'import ou la session de
      // caisse qui l'a provoqué. C'est ce qui rend une réservation restituable.
      reference: { type: 'string' },
      actor: { type: 'string' },
      // État résultant figé au moment du mouvement : permet de diagnostiquer une
      // divergence sans rejouer toute l'histoire.
      on_hand_after: { type: 'integer', required: true },
      reserved_after: { type: 'integer', required: true },
      occurred_at: { type: 'timestamp', required: true },
    },
  },

  // ── Vente et livraison ─────────────────────────────────────────────────────

  Order: {
    status: 'live',
    table: 'orders',
    description:
      'Commande d\'un client. UN SEUL PRODUIT par commande dans le modèle actuel : '
      + 'un panier de N articles produit N commandes. Dette identifiée dans l\'audit '
      + 'critique de la roadmap, à corriger après l\'étape 5.',
    fields: {
      id: { type: 'id', required: true },
      client_id: { type: 'id', required: true, references: 'Person' },
      product_id: { type: 'id', required: true, references: 'Product' },
      store_id: { type: 'id', required: true, references: 'Store' },
      quantity: { type: 'integer', required: true },
      total_price: { type: 'money', required: true },
      status: {
        type: 'enum',
        values: [
          'placed', 'pending_driver', 'driver_assigned', 'picking_up',
          'picked_up', 'delivering', 'delivered', 'cancelled',
        ],
        required: true,
      },
      delivery_address: { type: 'string' },
      estimated_minutes: { type: 'integer' },
      created_at: { type: 'timestamp' },
      updated_at: { type: 'timestamp' },
    },
  },

  Delivery: {
    status: 'live',
    table: 'missions',
    description:
      'Mission de livraison rattachée à une commande. Nommée « mission » en base '
      + 'et dans le code livreur ; « Delivery » est le nom canonique.',
    fields: {
      id: { type: 'id', required: true },
      order_id: { type: 'id', required: true, references: 'Order' },
      driver_id: { type: 'id', references: 'Person' },
      status: {
        type: 'enum',
        values: [
          'available', 'offered', 'accepted', 'picking_up',
          'picked_up', 'delivering', 'delivered', 'cancelled',
        ],
        required: true,
      },
      offered_to_driver_id: { type: 'id', references: 'Person' },
      offer_expires_at: { type: 'timestamp' },
      accepted_at: { type: 'timestamp' },
      created_at: { type: 'timestamp' },
      updated_at: { type: 'timestamp' },
    },
  },

  // ── Frontière avec les logiciels tiers ─────────────────────────────────────

  // Ce que la frontière NE met PAS ici : les files sortante et entrante, les baux de
  // worker, les installations de connecteur. Ce sont des mécaniques de transport, pas du
  // vocabulaire métier — un commerçant ne parle jamais de son « outbox ». Le CDM décrit ce
  // dont Ma Zone parle, pas comment elle s'y prend (Loi 4).

  ExternalBinding: {
    // Vivante depuis l'étape 6. Les noms de champs suivent l'annexe technique (§4.4) et
    // non l'esquisse écrite à l'étape 1 : `mazone_id` plutôt que `local_id`, parce qu'au
    // milieu d'un fichier de connecteur, « local » est ambigu — le local de qui ?
    status: 'live',
    since: 'E6',
    table: 'external_bindings',
    description:
      'Correspondance entre une entité Ma Zone et son identifiant dans un logiciel '
      + 'tiers. Seul endroit du système où un identifiant externe est stocké.',
    fields: {
      id: { type: 'id', required: true },
      mazone_entity_type: { type: 'string', required: true },
      mazone_id: { type: 'id', required: true },
      connector_id: { type: 'string', required: true },
      external_id: { type: 'string', required: true },
      // Multi-outlet : deux magasins d'un même éditeur ont deux stocks distincts.
      external_location_id: { type: 'string' },
      // Horodatage de la SOURCE, pas le nôtre : c'est lui qui permet de reconnaître un
      // message en retard et de refuser de revenir en arrière.
      last_source_updated_at: { type: 'timestamp' },
      last_synced_at: { type: 'timestamp' },
      created_at: { type: 'timestamp' },
    },
  },

  SyncConflict: {
    status: 'live',
    since: 'E6',
    table: 'sync_conflicts',
    description:
      'Divergence constatée entre Ma Zone et un logiciel tiers. Visible par le '
      + 'commerçant : un conflit tu est un conflit qui devient une perte de confiance.',
    fields: {
      id: { type: 'id', required: true },
      connector_id: { type: 'string', required: true },
      store_id: { type: 'id', references: 'Store' },
      mazone_entity_type: { type: 'string' },
      // Peut être vide : un conflit fréquent est précisément qu'AUCUNE entité Ma Zone ne
      // corresponde à ce que l'éditeur envoie.
      mazone_id: { type: 'id' },
      external_id: { type: 'string' },
      attribute: { type: 'string', required: true },
      proposed_value: { type: 'string' },
      retained_value: { type: 'string' },
      losing_source: { type: 'string', required: true },
      // Pas de champ « résolution » : l'issue est toujours la même — Ma Zone garde sa
      // valeur — et ce qui varie est la RAISON. Un enum de résolution laisserait croire
      // qu'un arbitrage silencieux en faveur de l'extérieur est possible. Il ne l'est pas.
      reason: {
        type: 'enum',
        values: [
          'owner_priority', 'stale_timestamp', 'immutable',
          'computed_field', 'unmapped_entity', 'organ_refused',
        ],
        required: true,
      },
      payload_summary: { type: 'text' },
      source_updated_at: { type: 'timestamp' },
      acknowledged_at: { type: 'timestamp' },
      created_at: { type: 'timestamp' },
    },
  },
};

const ENTITY_NAMES = Object.keys(ENTITIES);

module.exports = { ENTITIES, ENTITY_NAMES };
