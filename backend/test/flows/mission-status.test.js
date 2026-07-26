/**
 * Flux critique 5 — transitions de statut de mission
 * (`PATCH /api/missions/:id/status`).
 *
 * Écrits comme tests de CARACTÉRISATION à l'étape 1 (Loi 13). Depuis l'étape 3,
 * ils valent spécification : mission et commande avancent dans une seule
 * transaction, arbitrée par le graphe de `lib/orders/lifecycle.js`.
 */

process.env.DISPATCH_OFFER_DURATION_SEC = '5';

const test = require('node:test');
const assert = require('node:assert/strict');
const h = require('../helpers/testServer');

test.beforeEach(() => h.reset());

test.after(async () => {
  await h.stopServer();
  h.cleanup();
});

/** Décor : commande passée, offerte au livreur, puis acceptée. */
async function acceptedMission() {
  const world = h.seedWorld({ stock: 5, driverOnline: true });
  const { body } = await h.api.post(
    '/api/orders',
    { product_id: world.product.id },
    { token: world.client.token }
  );
  const mission = h.read.missionForOrder(body.order.id);
  await h.api.post(`/api/missions/${mission.id}/accept`, {}, { token: world.driver.token });
  return { ...world, order: body.order, mission: h.read.mission(mission.id) };
}

/** Fait suivre au livreur une suite de statuts, en vérifiant chaque pas. */
async function advance(driver, mission, statuses) {
  for (const next of statuses) {
    const { status } = await h.api.patch(
      `/api/missions/${mission.id}/status`,
      { status: next },
      { token: driver.token }
    );
    assert.equal(status, 200, `transition vers ${next}`);
  }
}

test('le livreur suit le parcours nominal jusqu\'à la livraison', async () => {
  const { driver, mission, order } = await acceptedMission();

  const parcours = [
    ['picking_up', 'picking_up'],
    ['picked_up', 'picked_up'],
    ['delivering', 'delivering'],
    ['delivered', 'delivered'],
  ];

  for (const [missionStatus, orderStatus] of parcours) {
    const { status } = await h.api.patch(
      `/api/missions/${mission.id}/status`,
      { status: missionStatus },
      { token: driver.token }
    );
    assert.equal(status, 200, `transition vers ${missionStatus}`);
    assert.equal(h.read.mission(mission.id).status, missionStatus);
    // Le statut de la commande suit celui de la mission : un seul parcours
    // visible par le client.
    assert.equal(h.read.order(order.id).status, orderStatus);
  }
});

test('un statut hors liste est refusé', async () => {
  const { driver, mission } = await acceptedMission();

  const { status, body } = await h.api.patch(
    `/api/missions/${mission.id}/status`,
    { status: 'teleporte' },
    { token: driver.token }
  );

  assert.equal(status, 400);
  assert.match(body.error, /Statut invalide/);
});

test('un livreur ne peut pas modifier la mission d\'un autre', async () => {
  const { mission } = await acceptedMission();
  const other = h.createUser({ role: 'driver', name: 'Autre livreur' });

  const { status } = await h.api.patch(
    `/api/missions/${mission.id}/status`,
    { status: 'picking_up' },
    { token: other.token }
  );

  assert.equal(status, 404);
  assert.equal(h.read.mission(mission.id).status, 'accepted');
});

test('un client ne peut pas faire avancer une mission', async () => {
  const { client, mission } = await acceptedMission();

  const { status } = await h.api.patch(
    `/api/missions/${mission.id}/status`,
    { status: 'delivered' },
    { token: client.token }
  );

  assert.equal(status, 403);
});

test('la livraison libère le livreur pour une course en attente', async () => {
  const { driver, mission, client, store } = await acceptedMission();

  // Une deuxième commande attend, faute de livreur disponible.
  const other = h.createProduct({ storeId: store.id, name: 'Produit en attente', quantity: 5 });
  const { body } = await h.api.post('/api/orders', { product_id: other.id }, { token: client.token });
  assert.equal(body.dispatch, 'pending_driver');

  await advance(driver, mission, ['picking_up', 'picked_up', 'delivering', 'delivered']);

  // Le livreur libéré se voit immédiatement proposer la course en attente.
  assert.equal(h.read.missionForOrder(body.order.id).status, 'offered');
});

// ── Machine à états fail-fast — acquise à l'étape 3 ───────────────────────────
// Jusqu'à l'étape 3, aucun graphe n'existait : seule la liste des statuts valides
// était vérifiée, et `delivered → picking_up` était accepté. Le graphe de
// `lib/orders/lifecycle.js` tranche désormais, et un pas interdit n'écrit rien.

test('revenir en arrière depuis un état terminal est refusé', async () => {
  const { driver, mission, order } = await acceptedMission();
  await advance(driver, mission, ['picking_up', 'picked_up', 'delivering', 'delivered']);

  const { status, body } = await h.api.patch(
    `/api/missions/${mission.id}/status`,
    { status: 'picking_up' },
    { token: driver.token }
  );

  assert.equal(status, 409);
  assert.match(body.error, /interdite/);
  // Rien n'a bougé : ni la mission, ni la commande. La transaction a été annulée
  // en entier, pas seulement du côté commande.
  assert.equal(h.read.mission(mission.id).status, 'delivered');
  assert.equal(h.read.order(order.id).status, 'delivered');
});

test('sauter la récupération du colis est refusé', async () => {
  const { driver, mission, order } = await acceptedMission();

  // `driver_assigned → delivered` : se déclarer en cours de livraison sans avoir
  // le colis rendrait le suivi client mensonger.
  const { status } = await h.api.patch(
    `/api/missions/${mission.id}/status`,
    { status: 'delivered' },
    { token: driver.token }
  );

  assert.equal(status, 409);
  assert.equal(h.read.mission(mission.id).status, 'accepted');
  assert.equal(h.read.order(order.id).status, 'driver_assigned');
});

test('chaque pas du parcours est journalisé', async () => {
  const { driver, mission, order, client } = await acceptedMission();
  await advance(driver, mission, ['picking_up', 'picked_up', 'delivering', 'delivered']);

  const { body } = await h.api.get(`/api/orders/${order.id}/journal`, { token: client.token });
  const transitions = body.journal
    .filter((e) => e.type === 'transitioned')
    .map((e) => `${e.from_status}→${e.to_status}`);

  assert.deepEqual(transitions, [
    'pending_driver→driver_assigned',
    'driver_assigned→picking_up',
    'picking_up→picked_up',
    'picked_up→delivering',
    'delivering→delivered',
  ]);
});
