/**
 * Harnais de test — étape 1 de la roadmap Organe d'Orchestration.
 *
 * Chaque fichier de test tourne dans son propre process (`node --test`) et ouvre
 * sa propre base jetable via `MAZONE_DB_PATH`. Aucun test ne peut donc toucher
 * `data/mazone.db`, et deux fichiers de test ne se marchent jamais dessus.
 *
 * IMPORTANT : ce module doit être requis AVANT tout module qui charge `src/db`,
 * puisque la base est ouverte au moment du `require`.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

// ── Isolation : base jetable + environnement déterministe ─────────────────────

const dbDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mazone-test-'));
const dbPath = path.join(dbDir, 'test.db');

process.env.MAZONE_DB_PATH = dbPath;
process.env.MAZONE_SKIP_DOTENV = '1';
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = `test-${'x'.repeat(40)}`;
process.env.ADMIN_JWT_SECRET = `test-admin-${'x'.repeat(40)}`;
process.env.LOG_LEVEL = 'error';
// Étape 8 — le coffre à secrets des intégrations, posé ici pour deux raisons. Déterminisme :
// un test qui branche un logiciel exigeant des identifiants doit se comporter pareil sur
// toutes les machines. Hygiène : sans cette ligne, chaque suite ferait GÉNÉRER une clé de
// développement et l'écrirait dans `data/.dev-secrets.json`, c'est-à-dire dans le dépôt de
// travail de quelqu'un.
process.env.INTEGRATION_SECRET_KEY = Buffer.alloc(32, 7).toString('base64');
// Le mode proposition 20 s est le comportement de production par défaut : on le
// caractérise tel quel plutôt que de tester un chemin que personne n'utilise.
if (process.env.DISPATCH_OFFER_MODE === undefined) process.env.DISPATCH_OFFER_MODE = '1';

const db = require('../../src/db');
const { createServer } = require('../../src/app');
const jwt = require('jsonwebtoken');

// ── Cycle de vie du serveur ───────────────────────────────────────────────────

let handle = null;
/**
 * On mémorise la PROMESSE de démarrage, pas seulement le serveur démarré.
 *
 * Sans cela, deux requêtes lancées en parallèle (les tests de concurrence de
 * l'étape 4) voient toutes les deux `handle === null` avant que la première ait fini
 * d'écouter, et démarrent deux serveurs sur deux ports. Le second n'est jamais
 * fermé, et le process de test ne se termine plus.
 */
let starting = null;

/**
 * Démarre le serveur sur un port éphémère. Rate limiting désactivé : une suite de
 * tests épuiserait le quota et ferait échouer des assertions métier pour une
 * raison qui n'a rien à voir avec le métier.
 */
function startServer() {
  if (handle) return Promise.resolve(handle);
  if (starting) return starting;

  starting = (async () => {
    // `syncWorkers: false` : une boucle de synchronisation de fond rendrait les
    // assertions non déterministes — un message pourrait partir entre deux lignes de
    // test. Les tests appellent `integration.drain()` quand ils veulent voir la file
    // avancer, ce qui rend chaque effet explicite.
    const { app, server, io } = createServer({ rateLimiting: false, syncWorkers: false });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    handle = { app, server, io, baseUrl: `http://127.0.0.1:${server.address().port}` };
    return handle;
  })();

  return starting;
}

async function stopServer() {
  // Une offre de course en attente retient l'event loop jusqu'à son échéance :
  // sans cela le process de test ne se termine jamais.
  require('../../src/lib/dispatchOffer').clearAllOfferTimeouts();
  if (starting) await starting.catch(() => {});
  if (!handle) return;
  const { server, io } = handle;
  await new Promise((resolve) => io.close(resolve));
  await new Promise((resolve) => server.close(resolve));
  handle = null;
  starting = null;
}

function cleanup() {
  try {
    db.close();
  } catch {
    // déjà fermée
  }
  fs.rmSync(dbDir, { recursive: true, force: true });
}

// ── Requêtes HTTP ─────────────────────────────────────────────────────────────

/**
 * Appelle l'API et retourne toujours `{ status, body }` — jamais d'exception sur
 * un statut d'erreur : un test doit pouvoir asserter un 409 aussi simplement
 * qu'un 200.
 */
async function request(method, urlPath, { token, body, headers = {} } = {}) {
  const { baseUrl } = await startServer();
  const response = await fetch(`${baseUrl}${urlPath}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  const text = await response.text();
  let parsed = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = text;
  }
  return { status: response.status, body: parsed };
}

const api = {
  get: (p, opts) => request('GET', p, opts),
  post: (p, body, opts) => request('POST', p, { ...opts, body }),
  patch: (p, body, opts) => request('PATCH', p, { ...opts, body }),
  put: (p, body, opts) => request('PUT', p, { ...opts, body }),
  delete: (p, opts) => request('DELETE', p, opts),
};

// ── Isolation entre tests ─────────────────────────────────────────────────────

/**
 * Vide toutes les tables. Appelée en `beforeEach` : chaque test part d'une base
 * vide, ce qui autorise des assertions sur des comptes absolus (« exactement une
 * commande ») au lieu de comptes relatifs, beaucoup moins parlants en cas d'échec.
 *
 * La liste des tables est relue à CHAQUE appel : plusieurs modules créent leurs
 * tables au premier `require` (noyau, journaux d'organe). Une liste figée au
 * chargement du harnais laisserait fuir l'état de ces tables entre les tests.
 */
function reset() {
  const tables = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")
    .all()
    .map((row) => row.name);

  db.pragma('foreign_keys = OFF');
  const wipe = db.transaction(() => {
    for (const table of tables) db.prepare(`DELETE FROM ${table}`).run();
  });
  wipe();
  db.pragma('foreign_keys = ON');
}

// ── Fixtures ──────────────────────────────────────────────────────────────────
// On insère directement en base plutôt que de passer par `/api/auth/register` :
// bcrypt à 10 tours coûte ~100 ms par utilisateur, ce qui rendrait la suite
// inutilement lente. Le token est signé avec les mêmes claims que la route.

function uniqueEmail(prefix) {
  return `${prefix}-${crypto.randomBytes(6).toString('hex')}@test.mazone`;
}

function tokenFor(user) {
  return jwt.sign(
    { id: user.id, name: user.name, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );
}

function createUser({ role, name, address = '10 rue de Test', lat = 48.86, lng = 2.35, online = 0 }) {
  const id = db.generateId();
  const email = uniqueEmail(role);
  db.prepare(
    `INSERT INTO users (id, name, email, password, phone, role, address, lat, lng, driver_online)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, name || `${role} test`, email, 'hash-non-utilise', '0600000000', role, address, lat, lng, online);

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  return { ...user, token: tokenFor(user) };
}

function createStore({ merchantId, name = 'Boutique test', lat = 48.87, lng = 2.34 }) {
  const id = db.generateId();
  db.prepare(
    `INSERT INTO stores (id, merchant_id, name, address, description, phone, email, lat, lng)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, merchantId, name, '1 place du Test', 'Boutique de test', '0600000000', 'shop@test.mazone', lat, lng);
  return db.prepare('SELECT * FROM stores WHERE id = ?').get(id);
}

function createProduct({ storeId, name = 'Produit test', price = 10, quantity = 5, active = 1 }) {
  const id = db.generateId();
  db.prepare(
    `INSERT INTO products (id, store_id, name, description, price, quantity, category, active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, storeId, name, 'Description test', price, quantity, 'test', active);
  return db.prepare('SELECT * FROM products WHERE id = ?').get(id);
}

/**
 * Décor complet : un commerçant avec sa boutique et un produit, un client, et un
 * livreur (hors ligne par défaut — le passer en ligne est un acte explicite du
 * test, comme dans la vraie vie).
 */
function seedWorld({ stock = 5, price = 10, driverOnline = false } = {}) {
  const merchant = createUser({ role: 'merchant', name: 'Commerçant test' });
  const store = createStore({ merchantId: merchant.id });
  const product = createProduct({ storeId: store.id, price, quantity: stock });
  const client = createUser({ role: 'client', name: 'Client test' });
  const driver = createUser({ role: 'driver', name: 'Livreur test', online: driverOnline ? 1 : 0 });
  return { merchant, store, product, client, driver };
}

// ── Lecture directe de l'état (assertions) ────────────────────────────────────

const read = {
  product: (id) => db.prepare('SELECT * FROM products WHERE id = ?').get(id),
  stock: (id) => db.prepare('SELECT quantity FROM products WHERE id = ?').get(id)?.quantity,
  order: (id) => db.prepare('SELECT * FROM orders WHERE id = ?').get(id),
  orders: () => db.prepare('SELECT * FROM orders ORDER BY created_at').all(),
  missionForOrder: (orderId) => db.prepare('SELECT * FROM missions WHERE order_id = ?').get(orderId),
  mission: (id) => db.prepare('SELECT * FROM missions WHERE id = ?').get(id),
  cartItems: (clientId) => db.prepare('SELECT * FROM cart_items WHERE client_id = ?').all(clientId),
  conversations: (orderId) => db.prepare('SELECT * FROM conversations WHERE order_id = ?').all(orderId),
  merchantNotifications: (merchantId) =>
    db.prepare('SELECT * FROM merchant_notifications WHERE user_id = ?').all(merchantId),
};

module.exports = {
  db,
  api,
  startServer,
  stopServer,
  cleanup,
  reset,
  createUser,
  createStore,
  createProduct,
  seedWorld,
  tokenFor,
  read,
};
