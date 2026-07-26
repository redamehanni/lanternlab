/**
 * Étape 3 — organe Orders.
 *
 * Deux niveaux de vérification :
 *   1. le graphe de cycle de vie, testé seul, sans base ni serveur ;
 *   2. le moteur, testé sur une vraie base, pour la transactionnalité et le journal.
 *
 * Les lois vérifiées structurellement (« les routes ne décident plus »,
 * « le moteur n'émet pas de socket ») sont en fin de fichier : un test qui lit le
 * code source est le seul moyen d'empêcher la logique de revenir s'installer là
 * d'où on vient de l'extraire.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const h = require('./helpers/testServer');

const lifecycle = require('../src/lib/orders/lifecycle');
const orders = require('../src/lib/orders');

test.beforeEach(() => h.reset());

test.after(async () => {
  await h.stopServer();
  h.cleanup();
});

// ── Cycle de vie ──────────────────────────────────────────────────────────────

test('le graphe couvre tous les statuts canoniques et rien d\'autre', () => {
  const canonical = Object.values(lifecycle.ORDER_STATUS).sort();
  assert.deepEqual(Object.keys(lifecycle.LIFECYCLE).sort(), canonical);

  // Toute cible d'une transition doit être un statut déclaré : une arête vers un
  // statut fantôme bloquerait une commande sans qu'aucune erreur ne le dise.
  for (const [from, targets] of Object.entries(lifecycle.LIFECYCLE)) {
    for (const to of targets) {
      assert.ok(lifecycle.isKnownStatus(to), `${from} → ${to} pointe vers un statut inconnu`);
    }
  }
});

test('les statuts terminaux n\'ont aucune sortie', () => {
  for (const status of lifecycle.TERMINAL_STATUS) {
    assert.deepEqual(lifecycle.allowedTransitions(status), [], `${status} doit être un cul-de-sac`);
    assert.ok(lifecycle.isTerminalStatus(status));
  }
});

test('un statut historique est ramené au vocabulaire canonique', () => {
  assert.equal(lifecycle.normalizeOrderStatus('accepted'), 'driver_assigned');
  assert.equal(lifecycle.normalizeOrderStatus('searching_driver'), 'pending_driver');
  // Une transition depuis un statut historique doit fonctionner comme depuis son
  // équivalent canonique : la base contient encore des lignes anciennes.
  assert.ok(lifecycle.canTransition('accepted', 'picking_up'));
});

test('l\'annulation est possible tant que le colis n\'est pas sorti', () => {
  assert.ok(lifecycle.canClientCancel('pending_driver'));
  assert.ok(lifecycle.canClientCancel('driver_assigned'));
  assert.ok(lifecycle.canClientCancel('picking_up'));
  // Le colis a quitté la boutique : le commerçant a déjà engagé sa marchandise.
  assert.ok(!lifecycle.canClientCancel('picked_up'));
  assert.ok(!lifecycle.canClientCancel('delivering'));
  assert.ok(!lifecycle.canClientCancel('delivered'));
});

test('une transition interdite lève un 409, un statut inconnu un 400', () => {
  assert.throws(
    () => lifecycle.assertTransition('delivered', 'picking_up'),
    (err) => err.name === 'OrderTransitionError' && err.status === 409
  );
  assert.throws(
    () => lifecycle.assertTransition('pending_driver', 'teleporte'),
    (err) => err.status === 400
  );
});

// ── Moteur ────────────────────────────────────────────────────────────────────

/** Commande créée par le moteur, sans passer par HTTP. */
function createdOrder({ stock = 5, quantity = 1, idempotencyKey = null } = {}) {
  const world = h.seedWorld({ stock });
  const result = orders.createOrder({
    clientId: world.client.id,
    productId: world.product.id,
    quantity,
    idempotencyKey,
  });
  return { ...world, ...result };
}

test('une commande naît en recherche de livreur, avec sa mission', () => {
  const { order, mission } = createdOrder();

  assert.equal(order.status, lifecycle.INITIAL_STATUS);
  assert.ok(mission, 'la mission naît dans la même transaction');
  assert.equal(mission.order_id, order.id);
  assert.equal(mission.status, 'available');
});

test('le moteur ne cherche aucun livreur', () => {
  const world = h.seedWorld({ stock: 5, driverOnline: true });
  const { mission } = orders.createOrder({
    clientId: world.client.id,
    productId: world.product.id,
  });

  // Un livreur est en ligne, et pourtant rien ne lui a été proposé : décider QUI
  // livre n'est pas le travail de l'organe Orders.
  assert.equal(mission.status, 'available');
  assert.equal(mission.offered_to_driver_id, null);
});

test('un échec en cours de création ne laisse aucune trace', () => {
  const world = h.seedWorld({ stock: 2 });

  assert.throws(
    () => orders.createOrder({
      clientId: world.client.id,
      productId: world.product.id,
      quantity: 5,
    }),
    (err) => err.status === 409
  );

  assert.equal(h.read.stock(world.product.id), 2, 'stock intact');
  assert.equal(h.read.orders().length, 0, 'aucune commande');
  assert.equal(h.read.missionForOrder(null), undefined);
});

test('une quantité invalide est refusée avant toute écriture', () => {
  const world = h.seedWorld({ stock: 5 });

  for (const quantity of [0, -3, 'beaucoup']) {
    assert.throws(
      () => orders.createOrder({
        clientId: world.client.id,
        productId: world.product.id,
        quantity,
      }),
      (err) => err.status === 400,
      `quantity=${quantity}`
    );
  }
  assert.equal(h.read.stock(world.product.id), 5);
});

test('rejouer une clé rend la même commande sans rien reconsommer', () => {
  const first = createdOrder({ stock: 5, idempotencyKey: 'k-1' });

  const second = orders.createOrder({
    clientId: first.client.id,
    productId: first.product.id,
    quantity: 1,
    idempotencyKey: 'k-1',
  });

  assert.equal(second.replayed, true);
  assert.equal(second.order.id, first.order.id);
  assert.equal(h.read.orders().length, 1);
  assert.equal(h.read.stock(first.product.id), 4);
});

test('une transition passe par le graphe et se journalise', () => {
  const { order } = createdOrder();

  const updated = orders.transitionOrder(order.id, 'driver_assigned', { actor: 'moi' });
  assert.equal(updated.status, 'driver_assigned');

  const entry = orders.orderJournal.lastOfType(order.id, 'transitioned');
  assert.equal(entry.from_status, 'pending_driver');
  assert.equal(entry.to_status, 'driver_assigned');
  assert.equal(entry.actor, 'moi');
});

test('rejouer la même transition est sans effet et n\'ajoute rien au journal', () => {
  const { order } = createdOrder();
  orders.transitionOrder(order.id, 'driver_assigned');

  const before = orders.readJournal(order.id).length;
  orders.transitionOrder(order.id, 'driver_assigned');

  assert.equal(orders.readJournal(order.id).length, before);
});

test('une transition interdite n\'écrit rien', () => {
  const { order } = createdOrder();
  const journalBefore = orders.readJournal(order.id).length;

  assert.throws(
    () => orders.transitionOrder(order.id, 'delivered'),
    (err) => err.status === 409
  );

  assert.equal(h.read.order(order.id).status, 'pending_driver');
  assert.equal(orders.readJournal(order.id).length, journalBefore);
});

test('annuler restitue le stock, libère la mission et journalise les deux', () => {
  const { order, product } = createdOrder({ stock: 5, quantity: 2 });
  assert.equal(h.read.stock(product.id), 3);

  const { order: cancelled, restoredQuantity } = orders.cancelOrder(order.id, { actor: 'client' });

  assert.equal(cancelled.status, 'cancelled');
  assert.equal(restoredQuantity, 2);
  assert.equal(h.read.stock(product.id), 5);
  assert.equal(h.read.missionForOrder(order.id).status, 'cancelled');

  const types = orders.readJournal(order.id).map((e) => e.type);
  assert.deepEqual(types, ['created', 'stock_consumed', 'cancelled', 'stock_restored']);
});

test('annuler une commande déjà partie est refusé et ne restitue rien', () => {
  const { order, product } = createdOrder({ stock: 5, quantity: 2 });
  orders.transitionOrder(order.id, 'driver_assigned');
  orders.transitionOrder(order.id, 'picked_up');

  assert.throws(
    () => orders.cancelOrder(order.id),
    (err) => err.status === 409
  );

  assert.equal(h.read.stock(product.id), 3, 'le stock reste consommé');
  assert.equal(h.read.order(order.id).status, 'picked_up');
});

test('le journal raconte l\'histoire dans l\'ordre', () => {
  const { order } = createdOrder();
  orders.transitionOrder(order.id, 'driver_assigned');
  orders.transitionOrder(order.id, 'picking_up');
  orders.transitionOrder(order.id, 'picked_up');

  const journal = orders.readJournal(order.id);
  assert.deepEqual(
    journal.map((e) => e.type),
    ['created', 'stock_consumed', 'transitioned', 'transitioned', 'transitioned']
  );
  // Loi 9 : le journal est append-only. Aucune entrée n'a été réécrite, donc la
  // première reste la création, même après trois transitions.
  assert.equal(journal[0].to_status, 'pending_driver');
});

// ── Lois vérifiées sur le code source ─────────────────────────────────────────

const SRC = path.join(__dirname, '..', 'src');

function sourceOf(...segments) {
  return fs.readFileSync(path.join(SRC, ...segments), 'utf8');
}

test('LOI 7 : le moteur n\'émet aucun socket et n\'appelle aucune notification', () => {
  for (const file of ['orderEngine.js', 'lifecycle.js', 'orderJournal.js', 'placement.js']) {
    const source = sourceOf('lib', 'orders', file);
    assert.ok(!/\bio\.(emit|to)\(/.test(source), `${file} émet un socket`);
    assert.ok(!/createMerchantNotification/.test(source), `${file} notifie directement`);
  }
});

test('la route commandes ne décide plus rien du métier', () => {
  const source = sourceOf('routes', 'orders.js');

  // Aucune écriture SQL : les lectures d'affichage (`SELECT`) restent tolérées,
  // toute écriture signifie qu'une décision est remontée dans la route.
  assert.ok(!/\b(INSERT|UPDATE|DELETE)\b/i.test(source), 'la route écrit en base');
  assert.ok(!/db\.transaction/.test(source), 'la route ouvre une transaction');
  assert.ok(!/consumePromoStock|getEffectivePrice/.test(source), 'la route calcule un prix');
  assert.ok(!/tryDispatchNewOrder/.test(source), 'la route pilote le dispatch');
});

test('LOI 3 : seul l\'organe Dispatch écrit dans missions', () => {
  const engine = sourceOf('lib', 'orders', 'orderEngine.js');

  // Le moteur LIT les missions (pour renvoyer celle qu'il vient de faire créer)
  // mais ne les écrit jamais lui-même.
  assert.ok(!/(INSERT INTO|UPDATE) missions/i.test(engine), 'le moteur écrit dans missions');
  assert.ok(/createMissionForOrder|releaseMissionForOrder/.test(engine), 'la délégation est explicite');
});

test('le vocabulaire des statuts a une seule source', () => {
  const legacy = sourceOf('lib', 'orderStatus.js');
  assert.ok(/require\('\.\/orders\/lifecycle'\)/.test(legacy), 'orderStatus doit réexporter lifecycle');

  const { ORDER_STATUS } = require('../src/lib/orderStatus');
  assert.deepEqual(ORDER_STATUS, lifecycle.ORDER_STATUS);
});
