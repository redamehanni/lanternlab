/**
 * Flux critique 1 — création de commande directe (`POST /api/orders`).
 *
 * Écrits comme tests de CARACTÉRISATION à l'étape 1 (Loi 13) pour figer le
 * comportement avant l'extraction de l'organe Orders. Depuis l'étape 3, ils valent
 * spécification : le flux passe par `lib/orders/`, et les défauts qu'ils
 * documentaient (idempotence absente, décrément hors transaction) sont corrigés.
 *
 * Un défaut encore figé ici est signalé `COMPORTEMENT ACTUEL, À CORRIGER EN Ex` :
 * ce n'est pas une spécification souhaitée.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const h = require('../helpers/testServer');

test.beforeEach(() => h.reset());

test.after(async () => {
  await h.stopServer();
  h.cleanup();
});

test('un client commande un produit en stock', async () => {
  const { client, product, store } = h.seedWorld({ stock: 5, price: 12 });

  const { status, body } = await h.api.post(
    '/api/orders',
    { product_id: product.id, quantity: 2, delivery_address: '5 rue du Client' },
    { token: client.token }
  );

  assert.equal(status, 201);
  assert.ok(body.order, 'la réponse contient la commande');
  assert.equal(body.order.client_id, client.id);
  assert.equal(body.order.product_id, product.id);
  assert.equal(body.order.store_id, store.id);
  assert.equal(body.order.quantity, 2);
  assert.equal(body.order.total_price, 24);
});

test('le stock est décrémenté de la quantité commandée', async () => {
  const { client, product } = h.seedWorld({ stock: 5 });

  await h.api.post('/api/orders', { product_id: product.id, quantity: 3 }, { token: client.token });

  assert.equal(h.read.stock(product.id), 2);
});

test('une mission de livraison est créée avec la commande', async () => {
  const { client, product } = h.seedWorld({ stock: 5 });

  const { body } = await h.api.post(
    '/api/orders',
    { product_id: product.id },
    { token: client.token }
  );

  const mission = h.read.missionForOrder(body.order.id);
  assert.ok(mission, 'une mission existe pour la commande');
});

test('une conversation client-commerçant est ouverte', async () => {
  const { client, product } = h.seedWorld({ stock: 5 });

  const { body } = await h.api.post(
    '/api/orders',
    { product_id: product.id },
    { token: client.token }
  );

  const conversations = h.read.conversations(body.order.id);
  assert.equal(conversations.length, 1);
  assert.equal(conversations[0].kind, 'client_merchant');
});

test('le commerçant reçoit une notification', async () => {
  const { client, product, merchant } = h.seedWorld({ stock: 5 });

  await h.api.post('/api/orders', { product_id: product.id }, { token: client.token });

  const notifications = h.read.merchantNotifications(merchant.id);
  assert.equal(notifications.length, 1);
  assert.equal(notifications[0].type, 'order_new');
});

test('sans livreur en ligne la commande attend un livreur', async () => {
  const { client, product } = h.seedWorld({ stock: 5, driverOnline: false });

  const { body } = await h.api.post(
    '/api/orders',
    { product_id: product.id },
    { token: client.token }
  );

  assert.equal(body.dispatch, 'pending_driver');
});

test('le prix promotionnel est appliqué s\'il existe', async () => {
  const { client, product, store } = h.seedWorld({ stock: 10, price: 20 });

  h.db.prepare(
    `INSERT INTO promotions (id, store_id, product_id, type, discount_percent, promo_price, original_price, active)
     VALUES (?, ?, ?, 'discount', 50, 10, 20, 1)`
  ).run(h.db.generateId(), store.id, product.id);

  const { body } = await h.api.post(
    '/api/orders',
    { product_id: product.id, quantity: 2 },
    { token: client.token }
  );

  assert.equal(body.order.total_price, 20, 'prix promotionnel 10 € × 2');
});

// ── Cas d'échec ───────────────────────────────────────────────────────────────

test('commander sans product_id est refusé', async () => {
  const { client } = h.seedWorld();

  const { status, body } = await h.api.post('/api/orders', { quantity: 1 }, { token: client.token });

  assert.equal(status, 400);
  assert.match(body.error, /product_id/);
});

test('commander un produit inexistant renvoie 404', async () => {
  const { client } = h.seedWorld();

  const { status } = await h.api.post(
    '/api/orders',
    { product_id: 'produit-fantome' },
    { token: client.token }
  );

  assert.equal(status, 404);
});

test('commander plus que le stock est refusé et ne consomme rien', async () => {
  const { client, product } = h.seedWorld({ stock: 2 });

  const { status, body } = await h.api.post(
    '/api/orders',
    { product_id: product.id, quantity: 5 },
    { token: client.token }
  );

  // 409 depuis l'étape 4 : la requête est bien formée, c'est l'état du stock qui la
  // refuse — et cet état peut changer à la seconde suivante.
  assert.equal(status, 409);
  assert.match(body.error, /Stock insuffisant/);
  assert.equal(h.read.stock(product.id), 2, 'le stock est intact');
  assert.equal(h.read.orders().length, 0, 'aucune commande créée');
});

test('un commerçant ne peut pas passer commande', async () => {
  const { merchant, product } = h.seedWorld();

  const { status } = await h.api.post(
    '/api/orders',
    { product_id: product.id },
    { token: merchant.token }
  );

  assert.equal(status, 403);
});

test('commander sans token est refusé', async () => {
  const { product } = h.seedWorld();

  const { status } = await h.api.post('/api/orders', { product_id: product.id });

  assert.equal(status, 401);
});

// ── Idempotence — acquise à l'étape 3 ─────────────────────────────────────────

test('rejouer une clé d\'idempotence renvoie la première commande', async () => {
  const { client, product } = h.seedWorld({ stock: 10 });

  const payload = { product_id: product.id, quantity: 1 };
  const first = await h.api.post('/api/orders', payload, {
    token: client.token,
    headers: { 'Idempotency-Key': 'cle-repetee' },
  });
  const second = await h.api.post('/api/orders', payload, {
    token: client.token,
    headers: { 'Idempotency-Key': 'cle-repetee' },
  });

  assert.equal(first.status, 201);
  assert.equal(second.status, 201);
  assert.equal(second.body.order.id, first.body.order.id, 'la même commande est renvoyée');
  assert.equal(h.read.orders().length, 1, 'une seule commande en base');
  assert.equal(h.read.stock(product.id), 9, 'le stock n\'est décrémenté qu\'une fois');
});

test('la même clé pour une requête différente est un conflit', async () => {
  const { client, product } = h.seedWorld({ stock: 10 });

  await h.api.post('/api/orders', { product_id: product.id, quantity: 1 }, {
    token: client.token,
    headers: { 'Idempotency-Key': 'cle-detournee' },
  });

  // Réutiliser une clé pour autre chose est un bug d'appelant, pas un rejeu :
  // le silence ferait passer une commande pour une autre.
  const { status, body } = await h.api.post('/api/orders', { product_id: product.id, quantity: 4 }, {
    token: client.token,
    headers: { 'Idempotency-Key': 'cle-detournee' },
  });

  assert.equal(status, 409);
  assert.match(body.error, /idempotence/);
  assert.equal(h.read.orders().length, 1);
});

test('sans clé, deux commandes identiques restent deux commandes', async () => {
  const { client, product } = h.seedWorld({ stock: 10 });

  // L'idempotence est une garantie offerte à l'appelant qui la demande, pas une
  // déduplication imposée : un client peut légitimement commander deux fois.
  const payload = { product_id: product.id, quantity: 1 };
  await h.api.post('/api/orders', payload, { token: client.token });
  await h.api.post('/api/orders', payload, { token: client.token });

  assert.equal(h.read.orders().length, 2);
});

// ── Journal — Loi 9 ───────────────────────────────────────────────────────────

test('la création est journalisée avec la consommation de stock', async () => {
  const { client, product } = h.seedWorld({ stock: 5 });

  const { body } = await h.api.post(
    '/api/orders',
    { product_id: product.id, quantity: 2 },
    { token: client.token }
  );

  const { body: journalBody } = await h.api.get(
    `/api/orders/${body.order.id}/journal`,
    { token: client.token }
  );

  const types = journalBody.journal.map((e) => e.type);
  assert.deepEqual(types.slice(0, 2), ['created', 'stock_consumed']);
  assert.equal(journalBody.journal[0].to_status, 'pending_driver');
  assert.equal(journalBody.journal[0].actor, client.id);
  assert.equal(journalBody.journal[1].payload.quantity, 2);
});

test('un tiers ne peut pas lire le journal d\'une commande', async () => {
  const { client, product } = h.seedWorld({ stock: 5 });
  const { body } = await h.api.post('/api/orders', { product_id: product.id }, { token: client.token });
  const intrus = h.createUser({ role: 'client', name: 'Curieux' });

  const { status } = await h.api.get(`/api/orders/${body.order.id}/journal`, { token: intrus.token });

  assert.equal(status, 404);
});

// ── Défaut figé — corrigé à l'étape 4 ─────────────────────────────────────────

test('COMPORTEMENT ACTUEL, À CORRIGER EN E4 : le stock reste un compteur unique', async () => {
  const { client, product } = h.seedWorld({ stock: 3 });

  // `products.quantity` est un compteur unique : rien ne distingue le stock
  // physique de la disponibilité commercialisable. L'étape 4 introduit
  // `on_hand` / `reserved` / `available`.
  await h.api.post('/api/orders', { product_id: product.id, quantity: 1 }, { token: client.token });

  assert.equal(h.read.stock(product.id), 2);
});
