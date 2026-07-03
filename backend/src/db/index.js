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
db.prepare(`
  UPDATE missions SET driver_id = NULL, status = 'available', updated_at = datetime('now')
  WHERE status = 'offered'
`).run();
db.prepare(`
  UPDATE orders SET status = 'pending_driver', updated_at = datetime('now')
  WHERE status = 'offered'
`).run();

module.exports = db;
