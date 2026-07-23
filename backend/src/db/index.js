const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const DATA_DIR = path.join(__dirname, '../../data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const UPLOADS_DIR = path.join(__dirname, '../../uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const db = new Database(path.join(DATA_DIR, 'mazone.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    phone TEXT,
    role TEXT NOT NULL CHECK(role IN ('client', 'merchant', 'driver')),
    address TEXT,
    lat REAL,
    lng REAL,
    transport TEXT,
    photo_url TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS stores (
    id TEXT PRIMARY KEY,
    merchant_id TEXT NOT NULL REFERENCES users(id),
    name TEXT NOT NULL,
    address TEXT NOT NULL,
    description TEXT,
    phone TEXT,
    email TEXT,
    lat REAL,
    lng REAL,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    store_id TEXT NOT NULL REFERENCES stores(id),
    name TEXT NOT NULL,
    description TEXT,
    price REAL NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 0,
    category TEXT,
    image_url TEXT,
    barcode TEXT,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    client_id TEXT NOT NULL REFERENCES users(id),
    product_id TEXT NOT NULL REFERENCES products(id),
    store_id TEXT NOT NULL REFERENCES stores(id),
    quantity INTEGER NOT NULL DEFAULT 1,
    total_price REAL NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    delivery_address TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS missions (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL REFERENCES orders(id),
    driver_id TEXT REFERENCES users(id),
    status TEXT NOT NULL DEFAULT 'available',
    accepted_at TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL REFERENCES orders(id),
    sender_id TEXT NOT NULL REFERENCES users(id),
    content TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );

  -- Conversations séparées par paire de participants (issue #8)
  CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL REFERENCES orders(id),
    kind TEXT NOT NULL,            -- client_merchant | client_driver | merchant_driver
    user_a TEXT NOT NULL REFERENCES users(id),
    user_b TEXT NOT NULL REFERENCES users(id),
    created_at TEXT DEFAULT (datetime('now'))
  );

  -- Adresses enregistrées du client (issue #9)
  CREATE TABLE IF NOT EXISTS client_addresses (
    id TEXT PRIMARY KEY,
    client_id TEXT NOT NULL REFERENCES users(id),
    label TEXT,
    address TEXT NOT NULL,
    lat REAL,
    lng REAL,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_products_store    ON products(store_id);
  CREATE INDEX IF NOT EXISTS idx_orders_client     ON orders(client_id);
  CREATE INDEX IF NOT EXISTS idx_orders_store      ON orders(store_id);
  CREATE INDEX IF NOT EXISTS idx_missions_order    ON missions(order_id);
  CREATE INDEX IF NOT EXISTS idx_missions_driver   ON missions(driver_id);
  CREATE INDEX IF NOT EXISTS idx_messages_order    ON messages(order_id);
  CREATE INDEX IF NOT EXISTS idx_conv_order        ON conversations(order_id);
  CREATE INDEX IF NOT EXISTS idx_addr_client       ON client_addresses(client_id);

  CREATE TABLE IF NOT EXISTS cart_items (
    id TEXT PRIMARY KEY,
    client_id TEXT NOT NULL REFERENCES users(id),
    product_id TEXT NOT NULL REFERENCES products(id),
    quantity INTEGER NOT NULL DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(client_id, product_id)
  );

  CREATE TABLE IF NOT EXISTS store_favorites (
    id TEXT PRIMARY KEY,
    client_id TEXT NOT NULL REFERENCES users(id),
    store_id TEXT NOT NULL REFERENCES stores(id),
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(client_id, store_id)
  );

  CREATE TABLE IF NOT EXISTS promotions (
    id TEXT PRIMARY KEY,
    store_id TEXT NOT NULL REFERENCES stores(id),
    product_id TEXT NOT NULL REFERENCES products(id),
    type TEXT NOT NULL CHECK(type IN ('discount', 'buy_get')),
    discount_percent REAL,
    promo_price REAL,
    original_price REAL,
    buy_quantity INTEGER,
    get_quantity INTEGER,
    max_quantity INTEGER,
    remaining_quantity INTEGER,
    ends_at TEXT,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_cart_client       ON cart_items(client_id);
  CREATE INDEX IF NOT EXISTS idx_fav_client        ON store_favorites(client_id);
  CREATE INDEX IF NOT EXISTS idx_promo_store       ON promotions(store_id);
  CREATE INDEX IF NOT EXISTS idx_promo_product     ON promotions(product_id);
`);

/**
 * Ajoute une colonne si elle n'existe pas déjà (migration non destructive).
 */
function addColumnIfMissing(table, column, definition) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!cols.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    console.log(`[DB] Colonne ajoutée : ${table}.${column}`);
  }
}

// Migrations incrémentales (préservent les données existantes)
addColumnIfMissing('stores', 'category', 'TEXT');
addColumnIfMissing('stores', 'story', 'TEXT');
addColumnIfMissing('stores', 'photo_url', 'TEXT');
addColumnIfMissing('messages', 'conversation_id', 'TEXT');
addColumnIfMissing('orders', 'estimated_minutes', 'INTEGER');
addColumnIfMissing('users', 'first_name', 'TEXT');
addColumnIfMissing('users', 'last_name', 'TEXT');
addColumnIfMissing('users', 'driver_online', 'INTEGER NOT NULL DEFAULT 0');
addColumnIfMissing('users', 'vehicle_plate', 'TEXT');
addColumnIfMissing('missions', 'offered_to_driver_id', 'TEXT REFERENCES users(id)');
addColumnIfMissing('missions', 'offer_expires_at', 'TEXT');

// ── Communication organ migrations ─────────────────────────────────────────────
addColumnIfMissing('conversations', 'lifecycle', "TEXT NOT NULL DEFAULT 'ephemeral'");
addColumnIfMissing('conversations', 'store_id', 'TEXT');
addColumnIfMissing('conversations', 'status', "TEXT NOT NULL DEFAULT 'active'");
addColumnIfMissing('conversations', 'participant_mode', "TEXT NOT NULL DEFAULT 'dyadic'");
addColumnIfMissing('conversations', 'updated_at', 'TEXT');
addColumnIfMissing('messages', 'context_order_id', 'TEXT');
addColumnIfMissing('messages', 'message_type', "TEXT NOT NULL DEFAULT 'text'");

db.exec(`
  CREATE TABLE IF NOT EXISTS conversation_reads (
    conversation_id TEXT NOT NULL REFERENCES conversations(id),
    user_id TEXT NOT NULL REFERENCES users(id),
    last_read_at TEXT NOT NULL,
    PRIMARY KEY (conversation_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS store_members (
    store_id TEXT NOT NULL REFERENCES stores(id),
    user_id TEXT NOT NULL REFERENCES users(id),
    member_role TEXT NOT NULL DEFAULT 'owner',
    created_at TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (store_id, user_id)
  );

  CREATE INDEX IF NOT EXISTS idx_conv_store_client ON conversations(store_id, user_a);
  CREATE INDEX IF NOT EXISTS idx_conv_store ON conversations(store_id);
  CREATE INDEX IF NOT EXISTS idx_store_members_user ON store_members(user_id);
`);

db.prepare(`
  INSERT OR IGNORE INTO store_members (store_id, user_id, member_role)
  SELECT id, merchant_id, 'owner' FROM stores WHERE merchant_id IS NOT NULL
`).run();

db.prepare(`
  UPDATE conversations SET store_id = (
    SELECT o.store_id FROM orders o WHERE o.id = conversations.order_id
  )
  WHERE store_id IS NULL AND order_id IS NOT NULL
`).run();

db.prepare(`
  UPDATE conversations SET lifecycle = 'durable', participant_mode = 'store_team', status = 'active'
  WHERE kind = 'client_merchant'
`).run();

db.prepare(`
  UPDATE conversations SET lifecycle = 'ephemeral', participant_mode = 'dyadic'
  WHERE kind IN ('client_driver', 'merchant_driver')
`).run();

(function mergeDurableMerchantConversations() {
  const dupes = db.prepare(`
    SELECT store_id, user_a as client_id, GROUP_CONCAT(id) as ids, COUNT(*) as c
    FROM conversations
    WHERE kind = 'client_merchant' AND store_id IS NOT NULL
    GROUP BY store_id, user_a
    HAVING c > 1
  `).all();

  for (const row of dupes) {
    const ids = row.ids.split(',');
    const keepId = ids[0];
    for (const dropId of ids.slice(1)) {
      db.prepare('UPDATE messages SET conversation_id = ? WHERE conversation_id = ?').run(keepId, dropId);
      db.prepare('UPDATE conversation_reads SET conversation_id = ? WHERE conversation_id = ?').run(keepId, dropId);
      db.prepare('DELETE FROM conversations WHERE id = ?').run(dropId);
    }
    db.prepare(`UPDATE conversations SET lifecycle = 'durable', participant_mode = 'store_team', status = 'active' WHERE id = ?`).run(keepId);
  }
})();

db.prepare(`
  UPDATE conversations SET status = 'archived'
  WHERE lifecycle = 'ephemeral' AND order_id IN (
    SELECT id FROM orders WHERE status IN ('delivered', 'cancelled')
  )
`).run();

db.prepare(`
  UPDATE conversations SET updated_at = COALESCE(updated_at, created_at, datetime('now'))
  WHERE updated_at IS NULL
`).run();

db.exec(`
  CREATE TABLE IF NOT EXISTS driver_broadcast (
    id TEXT PRIMARY KEY,
    content TEXT NOT NULL,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS driver_notifications (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id),
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'system',
    read INTEGER NOT NULL DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS merchant_notifications (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id),
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'system',
    read INTEGER NOT NULL DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS support_threads (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    role TEXT NOT NULL DEFAULT 'driver',
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS support_messages (
    id TEXT PRIMARY KEY,
    thread_id TEXT NOT NULL REFERENCES support_threads(id),
    sender_id TEXT NOT NULL REFERENCES users(id),
    content TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );
`);

// Message global par défaut (admin futur)
const broadcastCount = db.prepare('SELECT COUNT(*) as n FROM driver_broadcast').get();
if (broadcastCount.n === 0) {
  db.prepare(`
    INSERT INTO driver_broadcast (id, content, active) VALUES (?, ?, 1)
  `).run(uuidv4(), 'Bienvenue sur Ma Zone Livreur. Passez en ligne pour recevoir vos premières courses.');
}

const notifCount = db.prepare('SELECT COUNT(*) as n FROM driver_notifications').get();
if (notifCount.n === 0) {
  db.prepare(`
    INSERT INTO driver_notifications (id, user_id, title, body, type)
    VALUES (?, NULL, ?, ?, 'system')
  `).run(uuidv4(), 'Bienvenue sur Ma Zone', 'Votre espace livreur est prêt. Passez en ligne pour commencer.');
}

const merchantNotifCount = db.prepare('SELECT COUNT(*) as n FROM merchant_notifications').get();
if (merchantNotifCount.n === 0) {
  db.prepare(`
    INSERT INTO merchant_notifications (id, user_id, title, body, type)
    VALUES (?, NULL, ?, ?, 'system')
  `).run(uuidv4(), 'Bienvenue sur Ma Zone', 'Votre espace commerçant est prêt. Gérez vos commandes et promotions ici.');
}

// ── Wallet Engine : registre des objets numériques du citoyen ─────────────────
// digital_objects       : projection d'état courant (lecture rapide).
// digital_object_events : journal append-only (biographie + audit, immuable).
db.exec(`
  CREATE TABLE IF NOT EXISTS digital_objects (
    id TEXT PRIMARY KEY,
    owner_id TEXT NOT NULL REFERENCES users(id),
    kind TEXT NOT NULL,
    family TEXT,
    status TEXT NOT NULL,
    retention TEXT NOT NULL DEFAULT 'entitlement_only',
    payload TEXT,
    display TEXT,
    source_engine TEXT NOT NULL,
    source_ref TEXT,
    zone_id TEXT,
    expires_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_digital_objects_owner ON digital_objects(owner_id);
  CREATE INDEX IF NOT EXISTS idx_digital_objects_owner_family ON digital_objects(owner_id, family);
  CREATE INDEX IF NOT EXISTS idx_digital_objects_owner_status ON digital_objects(owner_id, status);

  CREATE TABLE IF NOT EXISTS digital_object_events (
    id TEXT PRIMARY KEY,
    object_id TEXT NOT NULL REFERENCES digital_objects(id),
    type TEXT NOT NULL,
    from_status TEXT,
    to_status TEXT,
    payload TEXT,
    actor_engine TEXT,
    idempotency_key TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_object_events_object ON digital_object_events(object_id, created_at);
  CREATE UNIQUE INDEX IF NOT EXISTS idx_object_events_idempotency
    ON digital_object_events(object_id, idempotency_key)
    WHERE idempotency_key IS NOT NULL;
`);

// Migration non destructive : descripteur de présentation séparé du payload (ADR-002).
addColumnIfMissing('digital_objects', 'display', 'TEXT');

// ── Identity Engine : jetons de présentation d'identité du citoyen ────────────
// identity_presentations : projection d'état courant (jeton actif rotatif).
// identity_events        : journal append-only (audit des vérifications, immuable).
// Le `handle` est neutre vis-à-vis du canal (QR aujourd'hui, NFC/Wallet demain).
db.exec(`
  CREATE TABLE IF NOT EXISTS identity_presentations (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    handle TEXT NOT NULL UNIQUE,
    purpose TEXT NOT NULL,
    status TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_identity_pres_user ON identity_presentations(user_id, status);

  CREATE TABLE IF NOT EXISTS identity_events (
    id TEXT PRIMARY KEY,
    presentation_id TEXT REFERENCES identity_presentations(id),
    subject_id TEXT,
    verifier_id TEXT,
    verifier_role TEXT,
    purpose TEXT,
    channel TEXT,
    type TEXT NOT NULL,
    outcome TEXT,
    reason TEXT,
    idempotency_key TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_identity_events_subject ON identity_events(subject_id, created_at);
  CREATE INDEX IF NOT EXISTS idx_identity_events_presentation ON identity_events(presentation_id, created_at);
  CREATE UNIQUE INDEX IF NOT EXISTS idx_identity_events_idempotency
    ON identity_events(idempotency_key)
    WHERE idempotency_key IS NOT NULL;
`);

// ── Event Engine : initiatives locales et leur cycle de vie ───────────────────
// events        : projection d'état courant d'une initiative (lecture rapide).
// event_journal : journal append-only (biographie + audit, immuable).
// Le moteur aide la ville à PRODUIRE des initiatives (du brouillon à l'archivage).
// Le `payload` est opaque ; `display` est le descripteur d'affichage séparé.
db.exec(`
  CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    status TEXT NOT NULL,
    source_kind TEXT NOT NULL,
    source_id TEXT,
    title TEXT NOT NULL,
    summary TEXT,
    body TEXT,
    media TEXT,
    display TEXT,
    payload TEXT,
    starts_at TEXT,
    ends_at TEXT,
    timezone TEXT,
    lat REAL,
    lng REAL,
    zone_id TEXT,
    address TEXT,
    geo_precision TEXT,
    visibility TEXT NOT NULL DEFAULT 'public',
    capacity INTEGER,
    channels TEXT,
    store_id TEXT,
    product_id TEXT,
    parent_event_id TEXT,
    source_ref TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_events_type ON events(type);
  CREATE INDEX IF NOT EXISTS idx_events_status ON events(status);
  CREATE INDEX IF NOT EXISTS idx_events_source ON events(source_kind, source_id);
  CREATE INDEX IF NOT EXISTS idx_events_store ON events(store_id);
  CREATE INDEX IF NOT EXISTS idx_events_zone ON events(zone_id);

  CREATE TABLE IF NOT EXISTS event_journal (
    id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL REFERENCES events(id),
    type TEXT NOT NULL,
    from_status TEXT,
    to_status TEXT,
    actor TEXT,
    payload TEXT,
    idempotency_key TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_event_journal_event ON event_journal(event_id, created_at);
  CREATE UNIQUE INDEX IF NOT EXISTS idx_event_journal_idempotency
    ON event_journal(event_id, idempotency_key)
    WHERE idempotency_key IS NOT NULL;

  -- Mode Réception : chaque habitant construit ses canaux d'écoute (+ rayon géo).
  -- Ce n'est pas un simple ON/OFF : c'est la façon dont les initiatives lui
  -- parviennent (diffusion), pas seulement un filtre d'affichage.
  CREATE TABLE IF NOT EXISTS event_subscriptions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    channel TEXT NOT NULL,
    radius_km REAL,
    zone_id TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(user_id, channel)
  );

  CREATE INDEX IF NOT EXISTS idx_event_subs_user ON event_subscriptions(user_id);
  CREATE INDEX IF NOT EXISTS idx_event_subs_channel ON event_subscriptions(channel);

  -- Opportunités Volantes : une STRATEGIE DE DIFFUSION attachee a une initiative
  -- (ciblage canal + fenetre temporelle + proximite). Ce n'est PAS un type
  -- d'evenement. La cle idempotency_key garantit qu'un envoi ne se rejoue jamais.
  CREATE TABLE IF NOT EXISTS event_diffusions (
    id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL REFERENCES events(id),
    channel TEXT NOT NULL,
    policy TEXT,
    window_start TEXT,
    window_end TEXT,
    status TEXT NOT NULL DEFAULT 'sent',
    reached INTEGER NOT NULL DEFAULT 0,
    idempotency_key TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_event_diffusions_event ON event_diffusions(event_id, created_at);
  CREATE UNIQUE INDEX IF NOT EXISTS idx_event_diffusions_idempotency
    ON event_diffusions(idempotency_key)
    WHERE idempotency_key IS NOT NULL;

  -- Boîte aux lettres : reçus PAR HABITANT d'une Opportunité Volante.
  -- Distinct de event_diffusions (agrégat de campagne). Métadonnées opaques
  -- (meta) : réserve d'extensibilité pour une future rareté / Ticket d'Or,
  -- sans toucher au schéma ni au cœur de cycle de vie.
  CREATE TABLE IF NOT EXISTS event_opportunity_inbox (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    event_id TEXT NOT NULL REFERENCES events(id),
    diffusion_id TEXT REFERENCES event_diffusions(id),
    channels TEXT,
    distance_km REAL,
    status TEXT NOT NULL DEFAULT 'received',
    meta TEXT,
    ticket_object_id TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_event_opp_inbox_user ON event_opportunity_inbox(user_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_event_opp_inbox_event ON event_opportunity_inbox(event_id);
  CREATE UNIQUE INDEX IF NOT EXISTS idx_event_opp_inbox_unique
    ON event_opportunity_inbox(user_id, event_id, diffusion_id);
`);

// ── Bac à Sable : administration interne + World Factory ──────────────────────
// admin_users   : équipe Ma Zone, STRICTEMENT hors de l'écosystème citoyen.
// demo_batches  : une exécution de recette World Factory.
// demo_entities : provenance de tout ce que la World Factory a créé (reset propre).
db.exec(`
  CREATE TABLE IF NOT EXISTS admin_users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    name TEXT,
    level TEXT NOT NULL DEFAULT 'operator',
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS demo_batches (
    id TEXT PRIMARY KEY,
    recipe_id TEXT NOT NULL,
    label TEXT,
    params TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS demo_entities (
    id TEXT PRIMARY KEY,
    batch_id TEXT NOT NULL REFERENCES demo_batches(id),
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_demo_entities_batch ON demo_entities(batch_id);
`);

db.generateId = () => uuidv4();

// Migration vers statuts stables (pending_driver / driver_assigned)
db.prepare(`
  UPDATE orders SET status = 'pending_driver'
  WHERE status IN ('pending', 'searching_driver', 'placed', 'offered')
    AND status NOT IN ('delivered', 'cancelled')
`).run();
db.prepare(`
  UPDATE orders SET status = 'driver_assigned'
  WHERE status IN ('accepted', 'accepted_by_driver')
`).run();
// Ne plus effacer les offres en cours — incompatible avec le mode proposition (Phase F UX)

module.exports = db;
