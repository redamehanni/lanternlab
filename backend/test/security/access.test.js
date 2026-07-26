/**
 * Étape 1 — correctifs d'autorisation.
 *
 * Contrairement aux tests de caractérisation, ceux-ci décrivent le comportement
 * VOULU : ils échouaient avant le correctif. Trois trous étaient ouverts :
 *   - lecture de n'importe quelle commande par n'importe quel porteur de token ;
 *   - changement de statut par n'importe quel rôle, sans lien avec la commande ;
 *   - entrée dans n'importe quelle room socket de commande ou de conversation.
 */

process.env.DISPATCH_OFFER_DURATION_SEC = '5';

const test = require('node:test');
const assert = require('node:assert/strict');
const h = require('../helpers/testServer');
const access = require('../../src/lib/access');

test.beforeEach(() => h.reset());

test.after(async () => {
  await h.stopServer();
  h.cleanup();
});

async function placeOrder() {
  const world = h.seedWorld({ stock: 5 });
  const { body } = await h.api.post(
    '/api/orders',
    { product_id: world.product.id, quantity: 1 },
    { token: world.client.token }
  );
  return { ...world, order: body.order };
}

// ── GET /api/orders/:id ───────────────────────────────────────────────────────

test('le client propriétaire lit sa commande', async () => {
  const { client, order } = await placeOrder();

  const { status, body } = await h.api.get(`/api/orders/${order.id}`, { token: client.token });

  assert.equal(status, 200);
  assert.equal(body.order.id, order.id);
});

test('le commerçant de la boutique lit la commande', async () => {
  const { merchant, order } = await placeOrder();

  const { status } = await h.api.get(`/api/orders/${order.id}`, { token: merchant.token });

  assert.equal(status, 200);
});

test('un autre client ne peut pas lire la commande', async () => {
  const { order } = await placeOrder();
  const intruder = h.createUser({ role: 'client', name: 'Intrus' });

  const { status } = await h.api.get(`/api/orders/${order.id}`, { token: intruder.token });

  // 404 et non 403 : on ne révèle pas l'existence de la commande.
  assert.equal(status, 404);
});

test('un commerçant tiers ne peut pas lire la commande', async () => {
  const { order } = await placeOrder();
  const other = h.createUser({ role: 'merchant', name: 'Concurrent' });
  h.createStore({ merchantId: other.id, name: 'Boutique concurrente' });

  const { status } = await h.api.get(`/api/orders/${order.id}`, { token: other.token });

  assert.equal(status, 404);
});

test('un livreur non affecté ne peut pas lire la commande', async () => {
  const { order, driver } = await placeOrder();

  const { status } = await h.api.get(`/api/orders/${order.id}`, { token: driver.token });

  assert.equal(status, 404);
});

test('le livreur destinataire d\'une offre peut lire la commande', async () => {
  const world = h.seedWorld({ stock: 5, driverOnline: true });
  const { body } = await h.api.post(
    '/api/orders',
    { product_id: world.product.id },
    { token: world.client.token }
  );

  // Il doit voir la course pour décider de l'accepter, avant toute affectation.
  const mission = h.read.missionForOrder(body.order.id);
  assert.equal(mission.offered_to_driver_id, world.driver.id);

  const { status } = await h.api.get(`/api/orders/${body.order.id}`, { token: world.driver.token });
  assert.equal(status, 200);
});

// ── PATCH /api/orders/:id/status ──────────────────────────────────────────────

test('le commerçant de la boutique change le statut', async () => {
  const { merchant, order } = await placeOrder();

  // Depuis `pending_driver`, l'annulation est le seul pas ouvert au commerçant :
  // c'est le graphe de l'organe Orders qui l'impose, pas cette route.
  const { status } = await h.api.patch(
    `/api/orders/${order.id}/status`,
    { status: 'cancelled' },
    { token: merchant.token }
  );

  assert.equal(status, 200);
  assert.equal(h.read.order(order.id).status, 'cancelled');
});

test('le client ne peut pas changer le statut de sa commande', async () => {
  const { client, order } = await placeOrder();

  const { status } = await h.api.patch(
    `/api/orders/${order.id}/status`,
    { status: 'delivered' },
    { token: client.token }
  );

  // Un client qui déclare sa commande livrée perd son droit d'annulation.
  assert.equal(status, 403);
  assert.equal(h.read.order(order.id).status, 'pending_driver');
});

test('un commerçant tiers ne peut pas changer le statut', async () => {
  const { order } = await placeOrder();
  const other = h.createUser({ role: 'merchant', name: 'Concurrent' });
  h.createStore({ merchantId: other.id, name: 'Boutique concurrente' });

  const { status, body } = await h.api.patch(
    `/api/orders/${order.id}/status`,
    { status: 'cancelled' },
    { token: other.token }
  );

  assert.equal(status, 403);
  assert.match(body.error, /partie prenante/);
  assert.equal(h.read.order(order.id).status, 'pending_driver');
});

test('un livreur non affecté ne peut pas changer le statut', async () => {
  const { order, driver } = await placeOrder();

  const { status } = await h.api.patch(
    `/api/orders/${order.id}/status`,
    { status: 'delivered' },
    { token: driver.token }
  );

  assert.equal(status, 403);
});

test('le livreur affecté change le statut', async () => {
  const world = h.seedWorld({ stock: 5, driverOnline: true });
  const { body } = await h.api.post(
    '/api/orders',
    { product_id: world.product.id },
    { token: world.client.token }
  );
  const mission = h.read.missionForOrder(body.order.id);
  await h.api.post(`/api/missions/${mission.id}/accept`, {}, { token: world.driver.token });

  const { status } = await h.api.patch(
    `/api/orders/${body.order.id}/status`,
    { status: 'picking_up' },
    { token: world.driver.token }
  );

  assert.equal(status, 200);
});

// ── Rooms socket ──────────────────────────────────────────────────────────────
// La garde des rooms appelle exactement les mêmes fonctions que les routes HTTP :
// on vérifie ici la décision, pas le transport. Deux chemins d'autorisation qui
// divergent finissent toujours par avoir deux niveaux de sécurité.

test('room de commande : seules les parties prenantes sont admises', async () => {
  const { order, client, merchant, driver } = await placeOrder();
  const intruder = h.createUser({ role: 'client', name: 'Intrus' });

  assert.equal(access.canViewOrder(client, order.id), true);
  assert.equal(access.canViewOrder(merchant, order.id), true);
  assert.equal(access.canViewOrder(driver, order.id), false, 'livreur non affecté');
  assert.equal(access.canViewOrder(intruder, order.id), false);
});

test('room de commande : une commande inexistante est refusée', async () => {
  const { client } = h.seedWorld();
  assert.equal(access.canViewOrder(client, 'commande-fantome'), false);
});

test('room de conversation : seuls les participants sont admis', async () => {
  const { order, client, merchant } = await placeOrder();
  const conversation = h.db
    .prepare("SELECT * FROM conversations WHERE kind = 'client_merchant'")
    .get();
  const intruder = h.createUser({ role: 'client', name: 'Intrus' });

  assert.ok(conversation, 'la conversation existe');
  assert.equal(access.canAccessConversation(client, conversation.id), true);
  assert.equal(access.canAccessConversation(merchant, conversation.id), true);
  assert.equal(access.canAccessConversation(intruder, conversation.id), false);
  assert.equal(access.canAccessConversation(client, 'conv-fantome'), false);
  assert.ok(order.id);
});

test('room de conversation : l\'équipe boutique accède au fil durable', async () => {
  const { store, merchant } = await placeOrder();
  const conversation = h.db
    .prepare("SELECT * FROM conversations WHERE kind = 'client_merchant'")
    .get();

  // Un employé ajouté à l'équipe voit le fil, même s'il n'est pas `user_b`.
  const employee = h.createUser({ role: 'merchant', name: 'Vendeur' });
  h.db.prepare(
    "INSERT INTO store_members (store_id, user_id, member_role) VALUES (?, ?, 'staff')"
  ).run(store.id, employee.id);

  assert.equal(conversation.participant_mode, 'store_team');
  assert.equal(access.canAccessConversation(employee, conversation.id), true);
  assert.equal(access.canAccessConversation(merchant, conversation.id), true);
});
