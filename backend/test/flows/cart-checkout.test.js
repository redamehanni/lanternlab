/**
 * Flux critique 2 — validation du panier (`POST /api/orders/cart`).
 *
 * TEST DE CARACTÉRISATION (Loi 13). Décrit le comportement ACTUEL.
 *
 * Défaut structurel figé ici : un panier de N articles produit N COMMANDES
 * distinctes, faute de table `order_items`. C'est la dette la plus lourde du
 * système, identifiée dans l'audit critique de la roadmap. Elle n'est pas traitée
 * avant l'étape 5 pour ne pas cumuler deux refontes sur le chemin critique.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const h = require('../helpers/testServer');

test.beforeEach(() => h.reset());

test.after(async () => {
  await h.stopServer();
  h.cleanup();
});

function addToCart(clientId, productId, quantity) {
  h.db.prepare(
    'INSERT INTO cart_items (id, client_id, product_id, quantity) VALUES (?, ?, ?, ?)'
  ).run(h.db.generateId(), clientId, productId, quantity);
}

test('COMPORTEMENT ACTUEL, À CORRIGER APRÈS E5 : un panier de 2 articles crée 2 commandes', async () => {
  const { client, store } = h.seedWorld({ stock: 10 });
  const second = h.createProduct({ storeId: store.id, name: 'Second produit', price: 5, quantity: 10 });
  const first = h.db.prepare('SELECT * FROM products WHERE store_id = ? AND name = ?').get(store.id, 'Produit test');

  addToCart(client.id, first.id, 1);
  addToCart(client.id, second.id, 2);

  const { status, body } = await h.api.post(
    '/api/orders/cart',
    { delivery_address: '5 rue du Client' },
    { token: client.token }
  );

  assert.equal(status, 201);
  // Le modèle cible serait UNE commande à deux lignes.
  assert.equal(body.orders.length, 2);
  assert.equal(h.read.orders().length, 2);
});

test('le stock de chaque article est décrémenté', async () => {
  const { client, store, product } = h.seedWorld({ stock: 10 });
  const second = h.createProduct({ storeId: store.id, name: 'Second produit', price: 5, quantity: 8 });

  addToCart(client.id, product.id, 3);
  addToCart(client.id, second.id, 2);

  await h.api.post('/api/orders/cart', {}, { token: client.token });

  assert.equal(h.read.stock(product.id), 7);
  assert.equal(h.read.stock(second.id), 6);
});

test('le panier est vidé après validation', async () => {
  const { client, product } = h.seedWorld({ stock: 10 });
  addToCart(client.id, product.id, 1);

  await h.api.post('/api/orders/cart', {}, { token: client.token });

  assert.equal(h.read.cartItems(client.id).length, 0);
});

test('la conversation client-commerçant est unique par boutique, pas par commande', async () => {
  const { client, store, product } = h.seedWorld({ stock: 10 });
  const second = h.createProduct({ storeId: store.id, name: 'Second produit', quantity: 10 });

  addToCart(client.id, product.id, 1);
  addToCart(client.id, second.id, 1);

  await h.api.post('/api/orders/cart', {}, { token: client.token });

  // Deux commandes, mais un seul fil de discussion : le lien client-boutique est
  // durable (`resolveDurableClientMerchant`) et ne se duplique pas à chaque
  // achat. Le fil garde le contexte de la première commande.
  const conversations = h.db
    .prepare("SELECT * FROM conversations WHERE kind = 'client_merchant' AND store_id = ?")
    .all(store.id);
  assert.equal(conversations.length, 1);
  assert.equal(conversations[0].lifecycle, 'durable');
});

// ── Cas d'échec ───────────────────────────────────────────────────────────────

test('valider un panier vide est refusé', async () => {
  const { client } = h.seedWorld();

  const { status, body } = await h.api.post('/api/orders/cart', {}, { token: client.token });

  assert.equal(status, 400);
  assert.match(body.error, /Panier vide/);
});

test('un produit désactivé est ignoré et le panier devient vide', async () => {
  const { client, store } = h.seedWorld({ stock: 10 });
  const inactive = h.createProduct({ storeId: store.id, name: 'Retiré', quantity: 5, active: 0 });
  addToCart(client.id, inactive.id, 1);

  const { status } = await h.api.post('/api/orders/cart', {}, { token: client.token });

  assert.equal(status, 400);
});

test('COMPORTEMENT ACTUEL, À CORRIGER EN E3 : un article en rupture laisse les précédents créés', async () => {
  const { client, store, product } = h.seedWorld({ stock: 10 });
  const rupture = h.createProduct({ storeId: store.id, name: 'Rupture', quantity: 1 });

  addToCart(client.id, product.id, 1);
  addToCart(client.id, rupture.id, 5);

  const { status, body } = await h.api.post('/api/orders/cart', {}, { token: client.token });

  assert.equal(status, 400);
  assert.match(body.error, /Stock insuffisant/);

  // La boucle n'est pas transactionnelle : la première commande survit à l'échec
  // de la seconde, le stock du premier article est consommé, et le panier n'est
  // pas vidé. Le client se retrouve avec une commande qu'il n'a pas validée.
  assert.equal(h.read.orders().length, 1);
  assert.equal(h.read.stock(product.id), 9);
  assert.equal(h.read.cartItems(client.id).length, 2);
});

test('un livreur ne peut pas valider un panier', async () => {
  const { driver } = h.seedWorld();

  const { status } = await h.api.post('/api/orders/cart', {}, { token: driver.token });

  assert.equal(status, 403);
});
