/**
 * Flux critique 3 — annulation client avec remise en stock
 * (`POST /api/orders/:id/cancel`).
 *
 * Écrits comme tests de CARACTÉRISATION à l'étape 1 (Loi 13). Depuis l'étape 4 ils
 * valent spécification : la restitution passe par `inventory.release`, qui ne rend
 * que ce qui reste réservé POUR CETTE COMMANDE.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const h = require('../helpers/testServer');

test.beforeEach(() => h.reset());

test.after(async () => {
  await h.stopServer();
  h.cleanup();
});

async function placeOrder({ stock = 5, quantity = 2 } = {}) {
  const world = h.seedWorld({ stock });
  const { body } = await h.api.post(
    '/api/orders',
    { product_id: world.product.id, quantity },
    { token: world.client.token }
  );
  return { ...world, order: body.order, quantity };
}

test('le client annule sa commande en attente de livreur', async () => {
  const { client, order } = await placeOrder();

  const { status, body } = await h.api.post(`/api/orders/${order.id}/cancel`, {}, { token: client.token });

  assert.equal(status, 200);
  assert.equal(body.order.status, 'cancelled');
});

test('le stock est restitué exactement', async () => {
  const { client, order, product } = await placeOrder({ stock: 5, quantity: 2 });
  assert.equal(h.read.stock(product.id), 3, 'stock réservé par la commande');

  await h.api.post(`/api/orders/${order.id}/cancel`, {}, { token: client.token });

  assert.equal(h.read.stock(product.id), 5, 'stock restitué, jamais plus');
});

test('la mission associée passe en annulée et perd son livreur', async () => {
  const { client, order } = await placeOrder();

  await h.api.post(`/api/orders/${order.id}/cancel`, {}, { token: client.token });

  const mission = h.read.missionForOrder(order.id);
  assert.equal(mission.status, 'cancelled');
  assert.equal(mission.driver_id, null);
  assert.equal(mission.offered_to_driver_id, null);
});

test('annuler deux fois est refusé la seconde fois', async () => {
  const { client, order, product } = await placeOrder({ stock: 5, quantity: 2 });

  const first = await h.api.post(`/api/orders/${order.id}/cancel`, {}, { token: client.token });
  const second = await h.api.post(`/api/orders/${order.id}/cancel`, {}, { token: client.token });

  assert.equal(first.status, 200);
  assert.equal(second.status, 409);
  // Point critique : une double annulation ne doit JAMAIS créditer le stock deux
  // fois. C'est le seul garde-fou actuel contre la création de stock fantôme.
  assert.equal(h.read.stock(product.id), 5);
});

test('une commande livrée ne peut plus être annulée', async () => {
  const { client, order, product } = await placeOrder({ stock: 5, quantity: 2 });
  h.db.prepare("UPDATE orders SET status = 'delivered' WHERE id = ?").run(order.id);

  const { status, body } = await h.api.post(`/api/orders/${order.id}/cancel`, {}, { token: client.token });

  assert.equal(status, 409);
  assert.match(body.error, /ne peut plus être annulée/);
  assert.equal(h.read.stock(product.id), 3, 'aucune restitution sur une commande livrée');
});

test('un autre client ne peut pas annuler la commande', async () => {
  const { order, product } = await placeOrder({ stock: 5, quantity: 2 });
  const intruder = h.createUser({ role: 'client', name: 'Intrus' });

  const { status } = await h.api.post(`/api/orders/${order.id}/cancel`, {}, { token: intruder.token });

  // 404 et non 403 : l'existence de la commande n'est pas révélée à un tiers.
  assert.equal(status, 404);
  assert.equal(h.read.stock(product.id), 3);
  assert.equal(h.read.order(order.id).status, 'pending_driver');
});

test('annuler une commande inexistante renvoie 404', async () => {
  const { client } = h.seedWorld();

  const { status } = await h.api.post('/api/orders/inexistante/cancel', {}, { token: client.token });

  assert.equal(status, 404);
});

// ── Stock promotionnel — corrigé à l'étape 4 ──────────────────────────────────
// Avant l'étape 4, `promotions.remaining_quantity` était décrémenté à la vente et
// jamais restitué : une série d'annulations épuisait une promotion qui n'avait rien
// vendu. La promotion visée est retrouvée par son identifiant, journalisé à la
// vente, et non par « la promotion active du produit » qui a pu changer entre-temps.

function seedPromotedProduct({ remaining = 5 } = {}) {
  const world = h.seedWorld({ stock: 10, price: 20 });
  const promotionId = h.db.generateId();
  h.db.prepare(
    `INSERT INTO promotions (id, store_id, product_id, type, discount_percent, promo_price,
                             original_price, max_quantity, remaining_quantity, active)
     VALUES (?, ?, ?, 'discount', 50, 10, 20, ?, ?, 1)`
  ).run(promotionId, world.store.id, world.product.id, remaining, remaining);
  return { ...world, promotionId };
}

function remainingOf(promotionId) {
  return h.db.prepare('SELECT remaining_quantity FROM promotions WHERE id = ?').get(promotionId)
    ?.remaining_quantity;
}

test('le stock promotionnel est restitué à l\'annulation', async () => {
  const { client, product, promotionId } = seedPromotedProduct({ remaining: 5 });

  const { body } = await h.api.post(
    '/api/orders',
    { product_id: product.id, quantity: 2 },
    { token: client.token }
  );
  assert.equal(remainingOf(promotionId), 3, 'la promotion a consommé 2 unités');

  await h.api.post(`/api/orders/${body.order.id}/cancel`, {}, { token: client.token });

  assert.equal(remainingOf(promotionId), 5, 'les 2 unités promotionnelles sont rendues');
});

test('une promotion épuisée puis annulée redevient active', async () => {
  const { client, product, promotionId } = seedPromotedProduct({ remaining: 2 });

  const { body } = await h.api.post(
    '/api/orders',
    { product_id: product.id, quantity: 2 },
    { token: client.token }
  );
  assert.equal(remainingOf(promotionId), 0);
  assert.equal(h.db.prepare('SELECT active FROM promotions WHERE id = ?').get(promotionId).active, 0);

  await h.api.post(`/api/orders/${body.order.id}/cancel`, {}, { token: client.token });

  assert.equal(remainingOf(promotionId), 2);
  assert.equal(h.db.prepare('SELECT active FROM promotions WHERE id = ?').get(promotionId).active, 1);
});

test('la restitution promotionnelle ne dépasse jamais le plafond', async () => {
  const { client, product, promotionId } = seedPromotedProduct({ remaining: 3 });

  const { body } = await h.api.post(
    '/api/orders',
    { product_id: product.id, quantity: 1 },
    { token: client.token }
  );
  await h.api.post(`/api/orders/${body.order.id}/cancel`, {}, { token: client.token });
  // Deuxième annulation refusée : elle ne doit rien rendre non plus.
  await h.api.post(`/api/orders/${body.order.id}/cancel`, {}, { token: client.token });

  assert.equal(remainingOf(promotionId), 3);
});
