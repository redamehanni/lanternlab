/**
 * Flux critique 4 — cycle de l'offre de course : proposition, refus, expiration,
 * réattribution.
 *
 * TEST DE CARACTÉRISATION (Loi 13). Décrit le comportement ACTUEL.
 *
 * La durée d'offre est ramenée à 1 seconde par `DISPATCH_OFFER_DURATION_SEC` :
 * caractériser une expiration de 20 secondes rendrait la suite inutilisable.
 */

process.env.DISPATCH_OFFER_DURATION_SEC = '1';

const test = require('node:test');
const assert = require('node:assert/strict');
const h = require('../helpers/testServer');

test.beforeEach(() => h.reset());

test.after(async () => {
  await h.stopServer();
  h.cleanup();
});

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function placeOrderWithOnlineDriver() {
  const world = h.seedWorld({ stock: 5, driverOnline: true });
  const { body } = await h.api.post(
    '/api/orders',
    { product_id: world.product.id },
    { token: world.client.token }
  );
  return { ...world, order: body.order, dispatch: body.dispatch };
}

test('la commande est proposée au livreur en ligne', async () => {
  const { order, driver, dispatch } = await placeOrderWithOnlineDriver();

  assert.equal(dispatch, 'offered');
  const mission = h.read.missionForOrder(order.id);
  assert.equal(mission.status, 'offered');
  assert.equal(mission.offered_to_driver_id, driver.id);
  assert.ok(mission.offer_expires_at, 'une échéance est posée');
  // Tant que l'offre n'est pas acceptée, la mission n'a pas de livreur.
  assert.equal(mission.driver_id, null);
});

test('le livreur voit son offre en cours', async () => {
  const { driver } = await placeOrderWithOnlineDriver();

  const { status, body } = await h.api.get('/api/missions/offered', { token: driver.token });

  assert.equal(status, 200);
  assert.ok(body.mission, 'une offre est retournée');
  assert.ok(body.offer.earnings > 0, 'le gain estimé est calculé');
});

test('accepter l\'offre attribue la mission et la commande', async () => {
  const { order, driver } = await placeOrderWithOnlineDriver();
  const mission = h.read.missionForOrder(order.id);

  const { status } = await h.api.post(`/api/missions/${mission.id}/accept`, {}, { token: driver.token });

  assert.equal(status, 200);
  const after = h.read.mission(mission.id);
  assert.equal(after.status, 'accepted');
  assert.equal(after.driver_id, driver.id);
  assert.equal(after.offered_to_driver_id, null);
  assert.equal(h.read.order(order.id).status, 'driver_assigned');
});

test('accepter ouvre les conversations livreur', async () => {
  const { order, driver } = await placeOrderWithOnlineDriver();
  const mission = h.read.missionForOrder(order.id);

  await h.api.post(`/api/missions/${mission.id}/accept`, {}, { token: driver.token });

  const kinds = h.read.conversations(order.id).map((c) => c.kind).sort();
  assert.deepEqual(kinds, ['client_driver', 'client_merchant', 'merchant_driver']);
});

test('un autre livreur ne peut pas accepter une offre nominative', async () => {
  const { order } = await placeOrderWithOnlineDriver();
  const mission = h.read.missionForOrder(order.id);
  const other = h.createUser({ role: 'driver', name: 'Autre livreur', online: 1 });

  const { status, body } = await h.api.post(
    `/api/missions/${mission.id}/accept`,
    {},
    { token: other.token }
  );

  assert.equal(status, 409);
  assert.match(body.error, /autre livreur/);
  assert.equal(h.read.mission(mission.id).driver_id, null);
});

test('refuser l\'offre remet la mission à disposition', async () => {
  const { order, driver } = await placeOrderWithOnlineDriver();
  const mission = h.read.missionForOrder(order.id);

  const { status, body } = await h.api.post(
    `/api/missions/${mission.id}/refuse`,
    {},
    { token: driver.token }
  );

  assert.equal(status, 200);
  assert.equal(body.refused, true);
  const after = h.read.mission(mission.id);
  assert.equal(after.status, 'available');
  assert.equal(after.offered_to_driver_id, null);
});

test('l\'offre expirée libère la mission', async () => {
  const { order } = await placeOrderWithOnlineDriver();
  const mission = h.read.missionForOrder(order.id);
  assert.equal(mission.status, 'offered');

  // La minuterie d'expiration vit en mémoire dans `dispatchOffer.js`.
  await sleep(1400);

  const after = h.read.mission(mission.id);
  assert.equal(after.status, 'available');
  assert.equal(after.offered_to_driver_id, null);
});

test('après expiration la course est proposée à un autre livreur', async () => {
  const world = h.seedWorld({ stock: 5, driverOnline: true });
  const second = h.createUser({ role: 'driver', name: 'Deuxième livreur', online: 1 });

  const { body } = await h.api.post(
    '/api/orders',
    { product_id: world.product.id },
    { token: world.client.token }
  );
  const mission = h.read.missionForOrder(body.order.id);
  const firstOffered = mission.offered_to_driver_id;

  await sleep(1400);

  const after = h.read.mission(mission.id);
  assert.equal(after.status, 'offered', 'réattribuée, pas laissée en attente');
  assert.notEqual(after.offered_to_driver_id, firstOffered);
  assert.ok([world.driver.id, second.id].includes(after.offered_to_driver_id));
});

test('un livreur déjà en mission acceptée ne reçoit pas de nouvelle offre', async () => {
  const first = await placeOrderWithOnlineDriver();
  const mission = h.read.missionForOrder(first.order.id);
  await h.api.post(`/api/missions/${mission.id}/accept`, {}, { token: first.driver.token });

  // Deuxième commande, même unique livreur : il est occupé.
  const secondProduct = h.createProduct({ storeId: first.store.id, name: 'Autre produit', quantity: 5 });
  const { body } = await h.api.post(
    '/api/orders',
    { product_id: secondProduct.id },
    { token: first.client.token }
  );

  assert.equal(body.dispatch, 'pending_driver');
  assert.equal(h.read.missionForOrder(body.order.id).status, 'available');
});

test('COMPORTEMENT ACTUEL, À CORRIGER APRÈS E5 : la minuterie d\'expiration vit en mémoire', async () => {
  const { order } = await placeOrderWithOnlineDriver();
  const mission = h.read.missionForOrder(order.id);

  // `offer_expires_at` est en base, mais c'est un `setTimeout` de process qui
  // déclenche la libération. Un redémarrage entre les deux laisse la mission
  // bloquée en `offered` sans que personne ne la reprenne : l'échéance est
  // dépassée en base et aucun mécanisme ne la relit.
  assert.ok(mission.offer_expires_at, 'échéance persistée');
  assert.equal(mission.status, 'offered');
});
