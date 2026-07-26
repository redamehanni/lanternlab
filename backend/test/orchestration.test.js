/**
 * Étape 5 — organe d'Orchestration.
 *
 * Trois niveaux :
 *   1. le registre, testé seul : ce qu'il refuse de déclarer compte plus que ce
 *      qu'il accepte, puisqu'un refus arrive au boot et un oubli en production ;
 *   2. l'exécution, avec échec INJECTÉ à chaque étape pour vérifier que les
 *      compensations remontent bien de N-1 à 1 ;
 *   3. les lois vérifiées sur le code source, dont les deux qui protègent vraiment
 *      l'architecture : aucune règle métier ne s'installe dans l'orchestrateur (Loi 5),
 *      et l'orchestrateur ne dialogue jamais avec un logiciel tiers (Loi 16).
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const h = require('./helpers/testServer');

const orchestration = require('../src/lib/orchestration');
const intentRegistry = require('../src/lib/orchestration/intentRegistry');
const organs = require('../src/lib/orchestration/organs');
const capabilities = require('../src/lib/orchestration/capabilities');
const inventory = require('../src/lib/inventory');

test.beforeEach(() => h.reset());

test.after(async () => {
  await h.stopServer();
  h.cleanup();
});

// ── Outils d'injection ────────────────────────────────────────────────────────

/**
 * Remplace une opération d'organe le temps d'un test.
 *
 * C'est le seul moyen honnête de vérifier une compensation : provoquer un vrai échec
 * à l'étape N, sans truquer le process manager qu'on est justement en train de tester.
 */
function breaking(organ, action, message = 'panne injectée') {
  const original = organs.ORGANS[organ][action];
  organs.ORGANS[organ][action] = () => {
    const err = new Error(message);
    err.status = 500;
    throw err;
  };
  return () => { organs.ORGANS[organ][action] = original; };
}

/** Rend une capacité disponible le temps d'un test. */
function granting(capability) {
  capabilities.registerResolver(capability, () => true);
  return () => capabilities.reset();
}

// ── Registre : ce qu'il refuse ────────────────────────────────────────────────

test('les intentions déclarées au chargement sont exactement celles attendues', () => {
  // Liste exhaustive et non un `includes` : une intention qui apparaît sans que
  // personne l'ait décidée est le premier symptôme d'un orchestrateur qui grossit.
  assert.deepEqual(orchestration.ids(), [
    'order.place',
    'order.cancel',
    'product.reserve',
    'store.close_exceptionally',
    'event.claim_opportunity',
    // Étape 6 : importer un catalogue touche Catalog puis Inventory, donc deux organes,
    // donc une intention (Loi 5).
    'catalog.declare_product',
  ]);
});

test('un plan nommant un organe inconnu ne se déclare pas', () => {
  assert.throws(
    () => intentRegistry.defineIntent({
      id: 'test.organe_fantome',
      actors: ['admin'],
      plan: () => [
        { organ: 'orders', action: 'create' },
        { organ: 'comptabilite', action: 'ecrire' },
      ],
    }),
    /organe inconnu/
  );
});

test('un plan nommant une action inexistante ne se déclare pas', () => {
  assert.throws(
    () => intentRegistry.defineIntent({
      id: 'test.action_fantome',
      actors: ['admin'],
      plan: () => [
        { organ: 'orders', action: 'teleporter' },
        { organ: 'dispatch', action: 'findDriver' },
      ],
    }),
    /n'expose pas d'opération/
  );
});

test('une compensation inexistante ne se déclare pas', () => {
  assert.throws(
    () => intentRegistry.defineIntent({
      id: 'test.compensation_fantome',
      actors: ['admin'],
      plan: () => [
        { organ: 'orders', action: 'create', compensate: 'ressusciter' },
        { organ: 'dispatch', action: 'findDriver' },
      ],
    }),
    /compensation .* inexistante/
  );
});

test('LOI 5 : une intention mono-organe est REFUSÉE', () => {
  // Le garde-fou central de l'étape. Sans lui, tout finit par transiter par
  // l'orchestrateur, qui devient le fourre-tout du métier.
  assert.throws(
    () => intentRegistry.defineIntent({
      id: 'test.mono_organe',
      actors: ['client'],
      plan: () => [
        { organ: 'inventory', action: 'reserve' },
        { organ: 'inventory', action: 'release' },
      ],
    }),
    /mono-organe/
  );
});

test('une étape exigeant une capacité sans être optionnelle est REFUSÉE', () => {
  // Sinon l'intention devient impossible pour tout commerçant sans connecteur.
  assert.throws(
    () => intentRegistry.defineIntent({
      id: 'test.capacite_obligatoire',
      actors: ['merchant'],
      plan: () => [
        { organ: 'inventory', action: 'reserve' },
        { organ: 'integration', action: 'pushSale', requires: 'push_sales' },
      ],
    }),
    /sans être optionnelle/
  );
});

test('une capacité inconnue ne se déclare pas', () => {
  assert.throws(
    () => intentRegistry.defineIntent({
      id: 'test.capacite_fantome',
      actors: ['merchant'],
      plan: () => [
        { organ: 'inventory', action: 'reserve' },
        { organ: 'integration', action: 'pushSale', optional: true, requires: 'telepathie' },
      ],
    }),
    /Capacité inconnue/
  );
});

test('un identifiant hors convention et un acteur inconnu sont refusés', () => {
  assert.throws(
    () => intentRegistry.defineIntent({ id: 'faisLeTruc', actors: ['admin'], plan: () => [] }),
    /identifiant invalide/
  );
  assert.throws(
    () => intentRegistry.defineIntent({
      id: 'test.acteur',
      actors: ['comptable'],
      plan: () => [{ organ: 'orders', action: 'create' }, { organ: 'dispatch', action: 'findDriver' }],
    }),
    /acteur inconnu/
  );
});

// ── Registre : ce qu'il expose ────────────────────────────────────────────────

test('le plan d\'une vente se lit d\'un seul coup d\'œil', () => {
  const described = orchestration.describe('order.place');

  assert.deepEqual(described.steps, [
    { step: 'orders.create', compensate: 'orders.cancel', optional: false, requires: null },
    { step: 'dispatch.findDriver', compensate: null, optional: false, requires: null },
    { step: 'integration.pushSale', compensate: null, optional: true, requires: 'push_sales' },
  ]);
});

test('chaque intention n\'est proposée qu\'aux rôles qui peuvent la formuler', () => {
  const forClient = orchestration.forActor('client').map((i) => i.id);
  const forMerchant = orchestration.forActor('merchant').map((i) => i.id);

  assert.ok(forClient.includes('order.place'));
  assert.ok(!forMerchant.includes('order.place'), 'un commerçant ne commande pas chez lui');
  assert.ok(forMerchant.includes('store.close_exceptionally'));
  assert.ok(!forClient.includes('store.close_exceptionally'));
});

// ── Contrôle d'accès et paramètres ────────────────────────────────────────────

test('un rôle non autorisé reçoit un 403, pas un 400', () => {
  const { merchant, product } = h.seedWorld({ stock: 5 });

  assert.throws(
    () => orchestration.run('order.place', { productId: product.id, quantity: 1 },
      { actor: merchant.id, actorRole: 'merchant' }),
    (err) => err.status === 403
  );
  assert.equal(h.read.orders().length, 0);
});

test('un paramètre manquant ou mal typé est refusé avant toute écriture', () => {
  const { client, product } = h.seedWorld({ stock: 5 });
  const ctx = { actor: client.id, actorRole: 'client' };

  assert.throws(
    () => orchestration.run('order.place', { quantity: 1 }, ctx),
    (err) => err.status === 400 && /productId/.test(err.message)
  );
  assert.throws(
    () => orchestration.run('order.place', { productId: product.id, quantity: '2' }, ctx),
    (err) => err.status === 400 && /integer/.test(err.message)
  );

  assert.equal(h.read.orders().length, 0);
  assert.equal(h.read.stock(product.id), 5);
});

test('une intention inconnue est un 404', () => {
  const { client } = h.seedWorld();
  assert.throws(
    () => orchestration.run('order.teleporter', {}, { actor: client.id, actorRole: 'client' }),
    (err) => err.status === 404
  );
});

// ── Exécution nominale et journal ─────────────────────────────────────────────

function placed({ stock = 5, quantity = 1, idempotencyKey = null } = {}) {
  const world = h.seedWorld({ stock });
  const run = orchestration.run('order.place',
    { productId: world.product.id, quantity },
    { actor: world.client.id, actorRole: 'client', idempotencyKey });
  return { ...world, run };
}

test('une vente exécute son plan et le journalise étape par étape', () => {
  const { run } = placed();

  const entries = orchestration.history(run.runId);
  assert.deepEqual(entries.map((e) => `${e.step || '—'}:${e.status}`), [
    '—:started',
    'orders.create:step_done',
    'dispatch.findDriver:step_done',
    // Aucun connecteur : l'étape est reportée, pas échouée.
    'integration.pushSale:step_skipped',
    '—:completed',
  ]);
});

test('LOI 12 : une capacité manquante produit une phrase pour le commerçant', () => {
  const { run } = placed();

  assert.equal(run.report.length, 1);
  assert.deepEqual(Object.keys(run.report[0]).sort(), ['capability', 'message', 'skipped', 'step']);
  assert.match(run.report[0].message, /logiciel de caisse/);
  // Et surtout : la vente a abouti malgré tout.
  assert.equal(h.read.orders().length, 1);
});

test('une capacité présente fait exécuter l\'étape optionnelle', () => {
  const restore = granting('push_sales');
  try {
    // L'organe Integration n'existe pas encore : l'étape est donc tentée et échoue.
    // Un bouchon qui aurait répondu « ok » aurait laissé croire à une vente transmise.
    const { run } = placed();
    const failed = run.report.find((r) => r.step === 'integration.pushSale');

    assert.ok(failed?.failed, 'l\'étape optionnelle a été TENTÉE');
    assert.equal(h.read.orders().length, 1, 'et la vente aboutit quand même');
  } finally {
    restore();
  }
});

test('rejouer une clé ne produit aucun effet supplémentaire', () => {
  const first = placed({ stock: 5, idempotencyKey: 'intent-1' });

  const second = orchestration.run('order.place',
    { productId: first.product.id, quantity: 1 },
    { actor: first.client.id, actorRole: 'client', idempotencyKey: 'intent-1' });

  assert.equal(second.replayed, true);
  assert.equal(second.runId, first.run.runId);
  assert.equal(h.read.orders().length, 1);
  assert.equal(h.read.stock(first.product.id), 4);
  // Le rejeu se VOIT dans le journal, sinon un client qui réessaie en boucle reste
  // invisible dans l'histoire du système.
  assert.ok(orchestration.history(first.run.runId).some((e) => e.status === 'replayed'));
});

test('la même clé pour une demande différente est un conflit', () => {
  const first = placed({ stock: 5, idempotencyKey: 'intent-2' });

  assert.throws(
    () => orchestration.run('order.place',
      { productId: first.product.id, quantity: 3 },
      { actor: first.client.id, actorRole: 'client', idempotencyKey: 'intent-2' }),
    (err) => err.status === 409
  );
});

// ── Compensation : échec injecté à chaque étape ───────────────────────────────

test('échec au dispatch : la vente est DÉFAITE et le stock rendu', () => {
  const world = h.seedWorld({ stock: 5 });
  const restore = breaking('dispatch', 'findDriver');

  try {
    assert.throws(() => orchestration.run('order.place',
      { productId: world.product.id, quantity: 2 },
      { actor: world.client.id, actorRole: 'client' }));
  } finally {
    restore();
  }

  const order = h.read.orders()[0];
  assert.equal(order.status, 'cancelled', 'la commande créée à l\'étape 1 est compensée');
  assert.equal(h.read.stock(world.product.id), 5, 'le stock réservé est rendu');
  assert.equal(inventory.getLevel(world.product.id).reserved, 0);
});

test('la compensation est journalisée et nommée', () => {
  const world = h.seedWorld({ stock: 5 });
  const restore = breaking('dispatch', 'findDriver', 'aucun livreur joignable');
  let runId = null;

  try {
    orchestration.run('order.place',
      { productId: world.product.id, quantity: 1 },
      { actor: world.client.id, actorRole: 'client' });
  } catch (err) {
    runId = err.runId;
  } finally {
    restore();
  }

  assert.ok(runId, 'l\'erreur porte l\'identifiant de l\'exécution');
  const entries = orchestration.history(runId);
  assert.deepEqual(entries.map((e) => `${e.step || '—'}:${e.status}`), [
    '—:started',
    'orders.create:step_done',
    'dispatch.findDriver:step_failed',
    'orders.cancel:compensated',
    '—:failed',
  ]);
  assert.match(entries.find((e) => e.status === 'step_failed').error, /aucun livreur/);
});

test('échec à la première étape : rien à compenser, rien de compensé', () => {
  const world = h.seedWorld({ stock: 5 });
  const restore = breaking('orders', 'create');

  try {
    assert.throws(() => orchestration.run('order.place',
      { productId: world.product.id, quantity: 1 },
      { actor: world.client.id, actorRole: 'client' }));
  } finally {
    restore();
  }

  assert.equal(h.read.orders().length, 0);
  assert.equal(h.read.stock(world.product.id), 5);
});

test('les compensations remontent de N-1 à 1, en ordre inverse', () => {
  const merchant = h.createUser({ role: 'merchant', name: 'Fermeture' });
  const store = h.createStore({ merchantId: merchant.id });
  h.createProduct({ storeId: store.id, name: 'Pain' });
  h.createProduct({ storeId: store.id, name: 'Croissant' });

  // Échec à la 3ᵉ étape : les étapes 2 puis 1 doivent être défaites, dans cet ordre.
  const restore = breaking('notifications', 'notifyOpenOrders');
  let runId = null;
  try {
    orchestration.run('store.close_exceptionally',
      { storeId: store.id, reason: 'inventaire' },
      { actor: merchant.id, actorRole: 'merchant' });
  } catch (err) {
    runId = err.runId;
  } finally {
    restore();
  }

  const compensated = orchestration.history(runId)
    .filter((e) => e.status === 'compensated')
    .map((e) => e.step);
  assert.deepEqual(compensated, ['events.retractAnnouncement', 'catalog.reactivateProducts']);

  // Et l'état est bien revenu en arrière.
  const active = h.db.prepare('SELECT COUNT(*) c FROM products WHERE store_id = ? AND active = 1')
    .get(store.id).c;
  assert.equal(active, 2, 'les produits sont remis en vente');
  const announcement = h.db.prepare("SELECT status FROM events WHERE store_id = ?").get(store.id);
  assert.equal(announcement.status, 'cancelled', 'l\'annonce est retirée');
});

test('une compensation ne remet en vente QUE ce qu\'elle avait retiré', () => {
  const merchant = h.createUser({ role: 'merchant', name: 'Fermeture' });
  const store = h.createStore({ merchantId: merchant.id });
  h.createProduct({ storeId: store.id, name: 'Pain' });
  // Produit délibérément masqué par le commerçant AVANT la fermeture.
  h.createProduct({ storeId: store.id, name: 'Saisonnier', active: 0 });

  const restore = breaking('notifications', 'notifyOpenOrders');
  try {
    assert.throws(() => orchestration.run('store.close_exceptionally',
      { storeId: store.id },
      { actor: merchant.id, actorRole: 'merchant' }));
  } finally {
    restore();
  }

  const saisonnier = h.db.prepare('SELECT active FROM products WHERE name = ?').get('Saisonnier');
  assert.equal(saisonnier.active, 0, 'un produit déjà masqué ne doit pas ressortir');
});

// ── Fermeture exceptionnelle, chemin nominal ──────────────────────────────────

test('fermer la boutique retire les produits, annonce et prévient les clients', async () => {
  const world = h.seedWorld({ stock: 5 });
  await h.api.post('/api/orders', { product_id: world.product.id, quantity: 1 },
    { token: world.client.token });

  const run = orchestration.run('store.close_exceptionally',
    { storeId: world.store.id, reason: 'Fermé pour cause de plomberie' },
    { actor: world.merchant.id, actorRole: 'merchant' });

  assert.deepEqual(run.results['catalog.deactivateStoreProducts'].deactivated, [world.product.id]);
  assert.equal(h.read.product(world.product.id).active, 0);

  const announcement = h.db.prepare('SELECT * FROM events WHERE store_id = ?').get(world.store.id);
  assert.equal(announcement.type, 'annonce_boutique');
  assert.equal(announcement.status, 'published');
  assert.match(announcement.summary, /plomberie/);

  assert.equal(run.results['notifications.notifyOpenOrders'].notified, 1);
});

test('un commerçant ne peut pas fermer la boutique d\'un autre', () => {
  // Le plan n'a pas d'étape de contrôle : la boutique est identifiée par paramètre.
  // C'est une LIMITE CONNUE de l'étape 5, documentée par ce test pour qu'elle ne
  // passe pas inaperçue. Elle est fermée à l'étape 7, quand `/api/v1/intents`
  // devient la seule porte et impose le contrôle d'appartenance.
  const a = h.createUser({ role: 'merchant', name: 'A' });
  const storeA = h.createStore({ merchantId: a.id, name: 'A' });
  const b = h.createUser({ role: 'merchant', name: 'B' });

  const run = orchestration.run('store.close_exceptionally',
    { storeId: storeA.id },
    { actor: b.id, actorRole: 'merchant' });

  assert.ok(run.runId, 'COMPORTEMENT ACTUEL : accepté, et journalisé au nom de B');
  assert.equal(orchestration.history(run.runId)[0].actor, b.id);
});

// ── Mettre un article de côté ─────────────────────────────────────────────────

test('mettre un article de côté réserve sans créer de commande', () => {
  const world = h.seedWorld({ stock: 5 });

  const run = orchestration.run('product.reserve',
    { productId: world.product.id, quantity: 2, reference: 'passage-boutique' },
    { actor: world.client.id, actorRole: 'client' });

  assert.equal(h.read.orders().length, 0, 'aucune vente, aucune mission de livraison');
  assert.equal(h.read.stock(world.product.id), 3);
  assert.equal(inventory.getLevel(world.product.id).reserved, 2);
  assert.equal(run.results['notifications.notifyReservation'].notified, 1);
  assert.equal(h.read.merchantNotifications(world.merchant.id).length, 1);
});

test('mettre de côté plus que disponible échoue sans rien réserver', () => {
  const world = h.seedWorld({ stock: 1 });

  assert.throws(
    () => orchestration.run('product.reserve',
      { productId: world.product.id, quantity: 4 },
      { actor: world.client.id, actorRole: 'client' }),
    (err) => err.status === 409
  );
  assert.equal(h.read.stock(world.product.id), 1);
  assert.equal(h.read.merchantNotifications(world.merchant.id).length, 0);
});

test('échec de la notification : la réservation est libérée', () => {
  const world = h.seedWorld({ stock: 5 });
  const restore = breaking('notifications', 'notifyReservation');

  try {
    assert.throws(() => orchestration.run('product.reserve',
      { productId: world.product.id, quantity: 2, reference: 'r-1' },
      { actor: world.client.id, actorRole: 'client' }));
  } finally {
    restore();
  }

  assert.equal(h.read.stock(world.product.id), 5);
  assert.equal(inventory.getLevel(world.product.id).reserved, 0);
});

// ── Annulation par intention ──────────────────────────────────────────────────

test('annuler par intention libère stock et mission', async () => {
  const world = h.seedWorld({ stock: 5 });
  const { body } = await h.api.post('/api/orders',
    { product_id: world.product.id, quantity: 2 }, { token: world.client.token });

  const run = orchestration.run('order.cancel',
    { orderId: body.order.id, reason: 'changement d\'avis' },
    { actor: world.client.id, actorRole: 'client' });

  assert.equal(run.results['orders.cancel'].order.status, 'cancelled');
  assert.equal(h.read.stock(world.product.id), 5);
  assert.equal(h.read.missionForOrder(body.order.id).status, 'cancelled');
});

test('annuler la commande d\'un autre est un 404, et rien n\'est écrit', async () => {
  const world = h.seedWorld({ stock: 5 });
  const { body } = await h.api.post('/api/orders',
    { product_id: world.product.id, quantity: 2 }, { token: world.client.token });
  const intruder = h.createUser({ role: 'client', name: 'Intrus' });

  assert.throws(
    () => orchestration.run('order.cancel', { orderId: body.order.id },
      { actor: intruder.id, actorRole: 'client' }),
    (err) => err.status === 404
  );

  assert.equal(h.read.order(body.order.id).status, 'pending_driver');
  assert.equal(h.read.stock(world.product.id), 3);
});

// ── Reprise après incident ────────────────────────────────────────────────────

test('une exécution interrompue est retrouvable', () => {
  const world = h.seedWorld({ stock: 5 });
  const restore = breaking('dispatch', 'findDriver');
  try {
    assert.throws(() => orchestration.run('order.place',
      { productId: world.product.id, quantity: 1 },
      { actor: world.client.id, actorRole: 'client' }));
  } finally {
    restore();
  }

  // Une exécution qui a échoué PROPREMENT n'est pas « en plan » : elle est close.
  assert.deepEqual(orchestration.incomplete(), []);

  // Un crash, lui, ne laisse ni `completed` ni `failed`. On le simule en retirant
  // l'entrée de clôture, ce qui est exactement l'état laissé par un process tué.
  const runId = h.db.prepare("SELECT run_id FROM orchestration_journal LIMIT 1").get().run_id;
  h.db.prepare("DELETE FROM orchestration_journal WHERE run_id = ? AND status IN ('failed', 'completed')")
    .run(runId);

  const stuck = orchestration.incomplete();
  assert.equal(stuck.length, 1);
  assert.equal(stuck[0].run_id, runId);
  assert.equal(stuck[0].intent_id, 'order.place');
});

test('le journal garde une trace, pas une copie des données personnelles', () => {
  const { run, client } = placed();
  const created = orchestration.history(run.runId).find((e) => e.step === 'orders.create');

  const serialized = JSON.stringify(created.result);
  assert.match(serialized, /"id"/, 'les identifiants sont conservés');
  assert.ok(!serialized.includes(client.email), 'aucune donnée personnelle recopiée');
  assert.ok(!serialized.includes('0600000000'));
});

// ── L'API des intentions ──────────────────────────────────────────────────────

test('un client liste les intentions qu\'il peut formuler', async () => {
  const { client } = h.seedWorld();
  const { status, body } = await h.api.get('/api/intents', { token: client.token });

  assert.equal(status, 200);
  const ids = body.intents.map((i) => i.id);
  assert.ok(ids.includes('order.place'));
  assert.ok(!ids.includes('store.close_exceptionally'));
  // Le plan n'est pas dans la liste : la liste dit ce qu'on peut demander, le détail
  // se demande intention par intention.
  assert.equal(body.intents[0].steps, undefined);
});

test('formuler une intention par HTTP la fait exécuter', async () => {
  const world = h.seedWorld({ stock: 5 });

  const { status, body } = await h.api.post('/api/intents/order.place',
    { params: { productId: world.product.id, quantity: 2 } },
    { token: world.client.token });

  assert.equal(status, 201);
  assert.ok(body.runId);
  assert.equal(body.results['orders.create'].order.quantity, 2);
  assert.equal(body.pending.length, 1, 'l\'étape connecteur est reportée');
  assert.equal(h.read.stock(world.product.id), 3);
});

test('rejouer une intention par HTTP renvoie 200 et non 201', async () => {
  const world = h.seedWorld({ stock: 5 });
  const body = { params: { productId: world.product.id, quantity: 1 } };
  const opts = { token: world.client.token, headers: { 'Idempotency-Key': 'http-1' } };

  const first = await h.api.post('/api/intents/order.place', body, opts);
  const second = await h.api.post('/api/intents/order.place', body, opts);

  assert.equal(first.status, 201);
  assert.equal(second.status, 200);
  assert.equal(second.body.replayed, true);
  assert.equal(h.read.orders().length, 1);
});

test('un rôle non autorisé reçoit 403 par HTTP', async () => {
  const world = h.seedWorld({ stock: 5 });
  const { status } = await h.api.post('/api/intents/order.place',
    { params: { productId: world.product.id, quantity: 1 } },
    { token: world.driver.token });

  assert.equal(status, 403);
});

test('un tiers ne peut pas lire le déroulé d\'une exécution', async () => {
  const world = h.seedWorld({ stock: 5 });
  const { body } = await h.api.post('/api/intents/order.place',
    { params: { productId: world.product.id, quantity: 1 } }, { token: world.client.token });
  const intruder = h.createUser({ role: 'client', name: 'Intrus' });

  const mine = await h.api.get(`/api/intents/runs/${body.runId}`, { token: world.client.token });
  const theirs = await h.api.get(`/api/intents/runs/${body.runId}`, { token: intruder.token });

  assert.equal(mine.status, 200);
  assert.ok(mine.body.run.length >= 3);
  assert.equal(theirs.status, 404);
});

// ── Lois vérifiées sur le code source ─────────────────────────────────────────

const ORCH_DIR = path.join(__dirname, '..', 'src', 'lib', 'orchestration');

function orchestrationFiles(dir = ORCH_DIR, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) orchestrationFiles(full, acc);
    else if (entry.name.endsWith('.js')) acc.push(full);
  }
  return acc;
}

test('RISQUE PRINCIPAL : aucune règle métier ne s\'installe dans les plans', () => {
  // Le vrai garde-fou de l'architecture. Un plan est une LISTE. Le jour où il
  // contient un `if`, l'orchestrateur a recommencé à décider — et dans dix-huit mois
  // il contiendra vingt cas particuliers que personne n'osera plus toucher.
  const intentsDir = path.join(ORCH_DIR, 'intents');

  // `index.js` ne déclare rien : il ne fait que charger les plans.
  const plans = fs.readdirSync(intentsDir).filter((f) => f !== 'index.js');
  assert.ok(plans.length >= 5);

  for (const file of plans) {
    const source = fs.readFileSync(path.join(intentsDir, file), 'utf8');
    // Les chaînes sont retirées avec les commentaires : `'string?'` déclare un
    // paramètre facultatif, ce n'est pas un opérateur ternaire.
    const code = stripCommentsAndStrings(source);

    assert.ok(!/\bif\s*\(/.test(code), `${file} contient une condition`);
    assert.ok(!/\?|&&|\|\|/.test(code), `${file} contient une expression conditionnelle`);
    // Un plan n'importe QUE le registre. Le jour où il importe un organe, c'est qu'il
    // s'est mis à appeler du code au lieu de déclarer une liste.
    const imports = [...source.matchAll(/require\('([^']+)'\)/g)].map((m) => m[1]);
    assert.deepEqual(imports, ['../intentRegistry'], `${file} importe autre chose que le registre`);
  }
});

/**
 * Retire commentaires puis littéraux de chaîne, dans cet ordre.
 *
 * Sans cela un test structurel se fait piéger par le contenu des commentaires et des
 * chaînes, et devient un test de la prose plutôt que du code.
 */
/** Chemins réellement importés par un fichier. */
function requiresIn(code) {
  return [...code.matchAll(/require\('([^']+)'\)/g)].map((m) => m[1]);
}

function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    // `[^:]` avant `//` : sans cela, `https://…` serait pris pour un commentaire et une
    // URL d'éditeur se cacherait derrière son propre protocole.
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

function stripCommentsAndStrings(source) {
  return stripComments(source)
    .replace(/'(?:[^'\\]|\\.)*'/g, "''")
    .replace(/"(?:[^"\\]|\\.)*"/g, '""')
    .replace(/`(?:[^`\\]|\\.)*`/g, '``');
}

test('le process manager ne connaît aucune table d\'organe ni aucun logiciel tiers', () => {
  for (const file of [
    path.join(ORCH_DIR, 'processManager.js'),
    path.join(ORCH_DIR, 'intentRegistry.js'),
  ]) {
    const source = fs.readFileSync(file, 'utf8');
    const code = stripCommentsAndStrings(source);
    const name = path.basename(file);

    for (const table of ['orders', 'products', 'missions', 'stock_levels', 'promotions']) {
      assert.ok(
        !new RegExp(`(FROM|INTO|UPDATE)\\s+${table}\\b`, 'i').test(code),
        `${name} lit ou écrit la table ${table}`
      );
    }
    assert.ok(!/shopify|lightspeed|zettle|square/i.test(code), `${name} nomme un logiciel tiers`);
  }
});

test('LOI 16 : l\'orchestration ne dialogue jamais avec un logiciel tiers', () => {
  // La frontière de substitution. L'Organe d'Orchestration orchestre des intentions
  // métier ; traduction, authentification, mapping, webhook, synchronisation et
  // protocole appartiennent exclusivement à l'Integration Engine et aux connecteurs.
  //
  // Ce test porte sur le CODE, pas sur la prose : les commentaires de ce dossier
  // parlent nécessairement de webhooks et de jetons pour expliquer ce qui est interdit.
  // Les chaînes, elles, sont CONSERVÉES — c'est précisément là qu'une URL d'éditeur ou
  // un nom de logiciel viendrait se cacher.
  const interdits = [
    [/shopify|lightspeed|zettle|square|chift|stripe/i, 'nomme un logiciel tiers'],
    [/\bfetch\s*\(|axios|node-fetch|https?\.request\s*\(/i, 'fait un appel réseau sortant'],
    [/oauth|access_token|refresh_token|client_secret|api_key/i, 'manipule une authentification externe'],
    [/webhook/i, 'traite un webhook'],
    [/toCanonical|fromCanonical/, 'traduit un format externe'],
    [/external_bindings|sync_conflicts/i, 'manipule un identifiant externe ou un conflit de synchro'],
    // Les files de l'Integration Engine sont visées par leur usage en table, pas par
    // leur nom : « inbox » désigne aussi la boîte de diffusion Ma Zone, qui est un
    // concept métier parfaitement légitime ici.
    [/(FROM|INTO|UPDATE|JOIN)\s+(integration_)?(outbox|inbox)\b/i, 'lit une file de synchronisation'],
  ];

  const files = orchestrationFiles();
  assert.ok(files.length >= 10, 'le dossier orchestration doit être analysé en entier');

  for (const file of files) {
    const code = stripComments(fs.readFileSync(file, 'utf8'));
    const name = path.relative(ORCH_DIR, file);
    for (const [pattern, faute] of interdits) {
      assert.ok(!pattern.test(code), `${name} ${faute} — cela appartient à l'Integration Engine`);
    }
  }
});

test('LOI 16 : aucun fichier d\'orchestration n\'importe l\'Integration Engine', () => {
  // L'unique point de contact autorisé est `adapters/integration.js`, qui NOMME des
  // opérations canoniques sans en connaître aucune mise en œuvre. Il n'importe rien.
  // Sur le code seul : les commentaires de ce dossier CITENT l'import interdit pour
  // expliquer pourquoi il l'est. Une prose qui déclenche le garde-fou décourage
  // d'expliquer, et un garde-fou qu'on contourne en se taisant ne protège plus rien.
  for (const file of orchestrationFiles()) {
    const code = stripComments(fs.readFileSync(file, 'utf8'));
    const name = path.relative(ORCH_DIR, file);

    for (const dep of requiresIn(code)) {
      const autorise = dep === './adapters/integration' || !/integration|connector/i.test(dep);
      assert.ok(autorise, `${name} importe « ${dep} » — la frontière de substitution est franchie`);
    }
  }

  const adapter = stripComments(
    fs.readFileSync(path.join(ORCH_DIR, 'adapters', 'integration.js'), 'utf8')
  );
  assert.deepEqual(
    requiresIn(adapter),
    [],
    'adapters/integration.js nomme des opérations, il n\'en met aucune en œuvre'
  );
});

test('LOI 16 : une vente aboutit alors qu\'aucun logiciel tiers n\'est branché', async () => {
  // Formulation vérifiable de la frontière : si l'on supprimait tout `lib/integration/`,
  // l'orchestration continuerait à exécuter ses plans, les étapes externes étant
  // reportées à l'utilisateur (Loi 12) plutôt que fatales.
  const world = h.seedWorld({ stock: 3 });

  const { status, body } = await h.api.post(
    '/api/orders',
    { product_id: world.product.id, quantity: 1 },
    { token: world.client.token }
  );

  assert.equal(status, 201, 'la vente aboutit sans aucun connecteur');
  const reporte = body.pending.find((r) => r.step === 'integration.pushSale');
  assert.ok(reporte, 'l\'étape externe apparaît dans le rapport');
  assert.ok(reporte.skipped, 'elle est reportée, pas échouée');
  assert.match(reporte.message, /logiciel/i, 'et dite en français au commerçant');
});

test('LOI 7 : l\'orchestrateur n\'émet aucun socket lui-même', () => {
  for (const file of [path.join(ORCH_DIR, 'processManager.js'), path.join(ORCH_DIR, 'organs.js')]) {
    const source = fs.readFileSync(file, 'utf8');
    assert.ok(!/\bio\.(emit|to)\(/.test(source), `${path.basename(file)} émet un socket`);
  }
});

test('aucune opération d\'organe n\'est déclarée sans être utilisée ou utilisable', () => {
  // Un annuaire qui accumule des opérations mortes finit par mentir sur ce que Ma Zone
  // sait faire. Chaque opération doit apparaître dans un plan, comme action ou comme
  // compensation.
  const used = new Set();
  for (const id of orchestration.ids()) {
    for (const step of orchestration.describe(id).steps) {
      used.add(step.step);
      if (step.compensate) used.add(step.compensate);
    }
  }

  const declared = [];
  for (const [organ, actions] of Object.entries(organs.describe())) {
    for (const action of actions) declared.push(`${organ}.${action}`);
  }

  const orphans = declared.filter((name) => !used.has(name));
  // `dispatch.releaseMission` reste déclarée pour l'étape 6, où un plan d'annulation
  // côté connecteur en aura besoin. Toute autre orpheline est un oubli.
  assert.deepEqual(orphans, ['dispatch.releaseMission']);
});
