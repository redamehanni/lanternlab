/**
 * Étape 6 — l'Integration Engine et le connecteur manuel.
 *
 * Ce fichier vérifie trois choses de nature différente, et l'ordre n'est pas indifférent.
 *
 *   1. LE CHEMIN D'ADOPTION A : un commerçant arrive avec un tableur et vend le même jour.
 *      C'est la promesse produit de l'étape ; si elle casse, le reste n'a pas d'intérêt.
 *   2. LA FIABILITÉ DU TRANSPORT : réessais, lettres mortes, déduplication, worker unique.
 *      Un message perdu en silence est le pire défaut d'un moteur d'intégration, parce
 *      qu'on ne l'apprend que par un client mécontent.
 *   3. LA FRONTIÈRE (Loi 16), vérifiée STRUCTURELLEMENT et pas seulement par les mots.
 *      Une frontière qu'aucun test ne garde est une intention, pas une architecture.
 *
 * Les workers de fond sont éteints (`syncWorkers: false` dans le harnais) et les files
 * sont vidées explicitement par `drain()`. Un test qui attend une boucle de fond est un
 * test qui échouera un jour sur une machine plus lente, pour une raison sans rapport.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const h = require('./helpers/testServer');
const integration = require('../src/lib/integration');
const registry = require('../src/lib/integration/connectorRegistry');
const contract = require('../src/lib/integration/contract');
const outbox = require('../src/lib/integration/outbox');
const inbox = require('../src/lib/integration/inbox');
const worker = require('../src/lib/integration/worker');
const bindings = require('../src/lib/integration/bindings');
const sync = require('../src/lib/integration/sync');
const catalog = require('../src/lib/catalog');
const inventory = require('../src/lib/inventory');
const orchestration = require('../src/lib/orchestration');

// Les capacités sont déclarées au boot de l'organe. Sans cet appel, une étape
// `requires: 'push_sales'` resterait éternellement reportée et les tests de bascule
// mesureraient l'absence de branchement, pas le comportement du moteur.
integration.boot({ workers: false });

test.beforeEach(() => {
  h.reset();
  worker.releaseAll();
});

test.after(async () => {
  await h.stopServer();
  h.cleanup();
});

// ── Connecteurs de test ───────────────────────────────────────────────────────
// Deux déclarations qui n'existent que pour éprouver des refus. Elles passent par le
// registre réel plutôt que par une simulation : ce qu'on veut vérifier est le contrat, et
// un contrat qu'on contourne pour le tester ne prouve rien.

/**
 * Exige des identifiants. Sert à vérifier qu'on ne le branche pas sans les avoir rangés.
 *
 * ÉTAPE 8 — cette déclaration a dû gagner deux lignes, et c'est un progrès du contrat, pas
 * une concession au test. À l'étape 6, un connecteur pouvait exiger des identifiants sans dire
 * comment on les obtient : il était déclarable et impossible à connecter. Le contrat exige
 * désormais un MODE DE CONNEXION, et un connecteur inconnectable est refusé au boot.
 */
registry.register({
  id: 'test_a_secrets',
  label: 'Logiciel imaginaire à identifiants',
  requiresAuth: true,
  secrets: ['api_key'],
  credentialFields: [{ name: 'api_key', label: 'Clé d\'API' }],
  capabilities: ['push_sales'],
  authenticate: () => ({ ok: true }),
  push: () => ({ externalRef: null }),
  fromCanonical: (resource, canonical) => canonical,
});

/**
 * Traduit sans filtrer — un connecteur écrit par quelqu'un de pressé.
 *
 * Il transmet TOUT ce que l'éditeur envoie, y compris des attributs qui n'appartiennent
 * pas à l'éditeur. C'est le cas que le journal de conflits existe pour attraper, et il
 * serait invisible avec le connecteur manuel, dont la traduction jette ce qu'elle ne
 * connaît pas.
 */
registry.register({
  id: 'test_brut',
  label: 'Connecteur sans filtre',
  capabilities: ['pull_inventory', 'push_sales'],
  pull: () => ({ items: [], nextCursor: null }),
  push: () => ({ externalRef: 'ext-1' }),
  toCanonical: (resource, external) => ({ ...external }),
  fromCanonical: (resource, canonical) => canonical,
});

// ── Fixtures ──────────────────────────────────────────────────────────────────

/** Une boutique avec le connecteur manuel branché — le point de départ le plus courant. */
function storeWithManual({ stock = 5 } = {}) {
  const world = h.seedWorld({ stock });
  integration.install({ storeId: world.store.id, connectorId: 'manual', actor: world.merchant.id });
  return world;
}

const CATALOGUE_CSV = [
  'reference;nom;prix;quantite;rayon',
  'CAFE-001;Café en grains 1kg;18,90;12;Épicerie',
  'THE-002;Thé vert bio;7,50;30;Épicerie',
  'MIEL-003;Miel de châtaignier;9,20;5;Épicerie',
].join('\n');

// ── 1. Le chemin d'adoption : un tableur, et on vend ──────────────────────────

test('un commerçant importe son tableur et ses produits sont vendables aussitôt', () => {
  const { store, merchant } = storeWithManual();

  const result = integration.importCatalog({
    storeId: store.id, document: CATALOGUE_CSV, actor: merchant.id,
  });

  assert.equal(result.imported, 3);
  assert.equal(result.created, 3);
  assert.deepEqual(result.rejected, []);

  const cafe = catalog.findByReference(store.id, 'CAFE-001');
  assert.equal(cafe.name, 'Café en grains 1kg');
  assert.equal(cafe.price, 18.9, 'un prix français « 18,90 » doit être compris');

  // Le point qui compte vraiment : le stock est VENDABLE, pas seulement enregistré.
  assert.equal(inventory.getSellableQty(cafe.id), 12);
  assert.equal(h.read.stock(cafe.id), 12, 'la projection lue par le mobile doit suivre');
});

test('réimporter le même fichier ne crée aucun doublon', () => {
  const { store, merchant } = storeWithManual();
  const importOnce = () => integration.importCatalog({
    storeId: store.id, document: CATALOGUE_CSV, actor: merchant.id,
  });

  importOnce();
  const second = importOnce();

  assert.equal(second.imported, 3);
  const count = h.db
    .prepare('SELECT COUNT(*) AS n FROM products WHERE store_id = ?')
    .get(store.id).n;
  // 3 importés + le produit du décor.
  assert.equal(count, 4, 'la référence, et non le nom, identifie un produit');
});

test('un fichier partiellement illisible importe le reste et dit ce qui a été refusé', () => {
  const { store, merchant } = storeWithManual();
  const document = [
    'reference;nom;quantite',
    'OK-001;Produit correct;4',
    ';Sans référence;3',
    'OK-002;;7',
    'OK-003;Quantité vide;',
    'OK-004;Quantité négative;-2',
    'OK-005;Autre produit correct;9',
  ].join('\n');

  const result = integration.importCatalog({ storeId: store.id, document, actor: merchant.id });

  assert.equal(result.imported, 2, 'le rejet global est le comportement qui fait abandonner');
  assert.equal(result.rejected.length, 4);
  assert.deepEqual(
    result.rejected.map((r) => r.reason),
    ['référence manquante', 'nom manquant', 'quantité vide ou illisible', 'quantité négative']
  );
  // Une cellule vide n'est PAS un zéro : deviner ferait disparaître un stock que le
  // commerçant croyait intact.
  assert.equal(catalog.findByReference(store.id, 'OK-003'), null);
});

test('un fichier sans colonne de quantité est refusé avec ce qui manque', () => {
  const { store, merchant } = storeWithManual();

  assert.throws(
    () => integration.importCatalog({
      storeId: store.id, document: 'reference;nom\nA-1;Article', actor: merchant.id,
    }),
    (err) => err.status === 422 && /quantité en stock/.test(err.message)
  );
});

test('importer sans avoir branché le connecteur est refusé', () => {
  const { store, merchant } = h.seedWorld();

  assert.throws(
    () => integration.importCatalog({
      storeId: store.id, document: CATALOGUE_CSV, actor: merchant.id,
    }),
    (err) => err.status === 409
  );
});

test('un import passe par une intention orchestrée, pas par un INSERT', () => {
  const { store, merchant } = storeWithManual();

  integration.importCatalog({ storeId: store.id, document: CATALOGUE_CSV, actor: merchant.id });

  const runs = h.db
    .prepare("SELECT * FROM orchestration_journal WHERE intent_id = 'catalog.declare_product'")
    .all();
  assert.equal(runs.length > 0, true, 'aucune trace d\'orchestration : l\'import a écrit seul');

  const cafe = catalog.findByReference(store.id, 'CAFE-001');
  const history = catalog.history(cafe.id);
  assert.equal(history.length > 0, true, 'toute décision de catalogue est journalisée (Loi 9)');
});

test('un import laisse une correspondance externe réutilisable', () => {
  const { store, merchant } = storeWithManual();
  integration.importCatalog({ storeId: store.id, document: CATALOGUE_CSV, actor: merchant.id });

  const cafe = catalog.findByReference(store.id, 'CAFE-001');
  const found = bindings.resolve({
    connectorId: 'manual',
    externalId: 'CAFE-001',
    entityType: bindings.ENTITY_TYPE.PRODUCT,
  });

  assert.equal(found.mazone_id, cafe.id, 'sans correspondance, un vrai connecteur recréerait le produit');
});

test('cinq cents articles s\'importent et se vendent', async () => {
  const { store, merchant, client } = storeWithManual();

  const lines = ['reference;nom;prix;quantite'];
  for (let i = 1; i <= 500; i += 1) {
    lines.push(`REF-${String(i).padStart(4, '0')};Article ${i};${(i % 50) + 1},00;${(i % 9) + 1}`);
  }

  const started = Date.now();
  const result = integration.importCatalog({
    storeId: store.id, document: lines.join('\n'), actor: merchant.id,
  });
  const elapsed = Date.now() - started;

  assert.equal(result.imported, 500);
  assert.deepEqual(result.rejected, []);
  // Seuil large exprès : ce test mesure un ordre de grandeur, pas une performance. Le jour
  // où un import de 500 lignes dépasse la minute, quelque chose de structurel a changé.
  assert.equal(elapsed < 60_000, true, `import trop lent : ${elapsed} ms`);

  // La promesse complète de l'étape : importé le matin, vendu l'après-midi.
  const article = catalog.findByReference(store.id, 'REF-0001');
  const sale = await h.api.post('/api/orders', {
    product_id: article.id,
    quantity: 1,
    delivery_address: '3 rue de la Vente',
  }, { token: client.token });

  assert.equal(sale.status, 201);
});

// ── 2. Capacités : la bascule promise à l'étape 5 ─────────────────────────────

test('sans connecteur branché, une vente aboutit et l\'étape externe est reportée', async () => {
  const { client, product } = h.seedWorld({ stock: 5 });

  const run = orchestration.run('order.place', {
    productId: product.id,
    quantity: 1,
    deliveryAddress: '4 rue du Report',
  }, { actor: client.id, actorRole: 'client' });

  const reporte = run.report.find((r) => r.step === 'integration.pushSale');
  assert.ok(reporte, 'ce qui n\'a pas pu être fait doit être DIT, jamais tu (Loi 12)');
  assert.equal(reporte.skipped, true, 'reportée, pas échouée : la vente, elle, a eu lieu');
  assert.ok(h.read.order(run.results['orders.create'].order.id));
  assert.equal(outbox.stats().pending, 0, 'rien ne doit être enfilé vers nulle part');
});

test('avec un connecteur branché, la même vente part sans qu\'aucun plan change', () => {
  const { store, client, product } = storeWithManual({ stock: 5 });

  const run = orchestration.run('order.place', {
    productId: product.id,
    quantity: 1,
    deliveryAddress: '5 rue de la Bascule',
  }, { actor: client.id, actorRole: 'client' });

  assert.deepEqual(run.report, [], 'la capacité est là : plus rien à reporter');

  const queued = integration.outboxForStore(store.id);
  assert.equal(queued.length, 1);
  assert.equal(queued[0].resource, 'order');
  assert.equal(queued[0].status, outbox.STATUS.PENDING);
});

test('un connecteur suspendu retire la capacité de la boutique', () => {
  const { store } = storeWithManual();
  assert.equal(integration.capabilitiesForStore(store.id).includes('push_sales'), true);

  integration.pause({ storeId: store.id, connectorId: 'manual' });

  assert.deepEqual(integration.capabilitiesForStore(store.id), []);
});

test('les capacités d\'une boutique sont l\'union de celles de ses connecteurs', () => {
  const { store } = storeWithManual();
  const capabilities = integration.capabilitiesForStore(store.id);

  assert.deepEqual(
    [...capabilities].sort(),
    ['pull_catalog', 'pull_inventory', 'push_sales']
  );
});

test('un connecteur exigeant des identifiants ne se branche pas sans ses identifiants', () => {
  const { store } = h.seedWorld();

  assert.throws(
    () => integration.install({ storeId: store.id, connectorId: 'test_a_secrets' }),
    // ÉTAPE 8 — LE REFUS A CHANGÉ DE NATURE, PAS DE FERMETÉ. L'étape 6 refusait faute de
    // coffre à secrets (501, « Ma Zone ne sait pas encore faire cela en sécurité »). Le coffre
    // existe, et le refus porte maintenant sur l'ORDRE DES GESTES : les identifiants se rangent
    // d'abord, par la connexion du logiciel, et le branchement les constate.
    //
    // Ce que cet invariant obtient sans aucun code spécifique : la route générique de
    // branchement devient inutilisable pour déclarer « ce logiciel est connecté » sans avoir
    // traversé le flux d'autorisation.
    (err) => err.status === 409 && /identifiants/.test(err.message)
  );
});

test('une capacité annoncée sans sa mécanique est refusée à la déclaration', () => {
  assert.throws(
    () => registry.register({
      id: 'test_menteur',
      label: 'Connecteur qui promet sans tenir',
      capabilities: ['push_sales'],
      // ni `push` ni `fromCanonical` : la promesse échouerait au premier usage réel.
      toCanonical: (r, e) => e,
    }),
    /n'implémente pas push/
  );
});

test('un identifiant de connecteur mal formé est refusé', () => {
  assert.throws(
    () => registry.register({
      id: 'Mon-Connecteur',
      label: 'Identifiant fantaisiste',
      capabilities: ['pull_catalog'],
      pull: () => ({ items: [] }),
      toCanonical: (r, e) => e,
    }),
    /identifiant de connecteur invalide/
  );
});

// ── 3. Transport sortant : livraison, réessai, lettre morte ───────────────────

test('la même vente enfilée deux fois ne produit qu\'un message', () => {
  const { store, product } = storeWithManual();
  const order = { id: 'cmd-idem', store_id: store.id, product_id: product.id, quantity: 1, total_price: 10 };

  const first = integration.pushSale({ order }, {});
  const second = integration.pushSale({ order }, {});

  assert.equal(first.queued[0].enqueued, true);
  assert.equal(second.queued[0].enqueued, false, 'la clé d\'idempotence doit absorber le doublon');
  assert.equal(outbox.forStore(store.id).length, 1);
});

test('vider la file marque le message livré', async () => {
  const { store, product } = storeWithManual();
  integration.pushSale({
    order: { id: 'cmd-1', store_id: store.id, product_id: product.id, quantity: 2, total_price: 20 },
  }, {});

  const { delivered } = await integration.drain();

  assert.equal(delivered, 1);
  assert.equal(outbox.forStore(store.id)[0].status, outbox.STATUS.SENT);
});

test('un envoi qui échoue est réessayé plus tard, pas abandonné', () => {
  const { store, product } = storeWithManual();
  integration.pushSale({
    order: { id: 'cmd-ko', store_id: store.id, product_id: product.id, quantity: 1, total_price: 10 },
  }, {});

  const message = outbox.forStore(store.id)[0];
  const panne = () => { throw new Error('éditeur injoignable'); };

  withFailingPush(panne, () => sync.deliver(outbox.get(message.id)));

  const after = outbox.get(message.id);
  assert.equal(after.status, outbox.STATUS.PENDING);
  assert.equal(after.attempts, 1);
  assert.match(after.last_error, /injoignable/);
  assert.equal(
    new Date(after.next_attempt_at.replace(' ', 'T') + 'Z') > new Date(),
    true,
    'le prochain essai doit être REPOUSSÉ, sinon la file tourne à vide sur une panne'
  );
});

test('après six échecs le message devient une lettre morte, visible', () => {
  const { store, product } = storeWithManual();
  integration.pushSale({
    order: { id: 'cmd-dlq', store_id: store.id, product_id: product.id, quantity: 1, total_price: 10 },
  }, {});
  const id = outbox.forStore(store.id)[0].id;

  withFailingPush(() => { throw new Error('panne durable'); }, () => {
    for (let attempt = 0; attempt < outbox.MAX_ATTEMPTS; attempt += 1) {
      // Le report est contourné à la main : attendre les backoffs réels prendrait des
      // minutes, et c'est le compteur qu'on teste, pas l'horloge.
      h.db.prepare('UPDATE integration_outbox SET next_attempt_at = datetime(\'now\', \'-1 minute\') WHERE id = ?').run(id);
      sync.deliver(outbox.get(id));
    }
  });

  const dead = outbox.get(id);
  assert.equal(dead.status, outbox.STATUS.DEAD);
  assert.equal(integration.deadLetters({ storeId: store.id }).length, 1);
  // Le point essentiel : la vente elle-même n'a pas été perdue.
  assert.equal(h.db.prepare('SELECT COUNT(*) AS n FROM integration_outbox').get().n, 1);
});

test('une lettre morte peut être remise en file après correction', async () => {
  const { store, product } = storeWithManual();
  integration.pushSale({
    order: { id: 'cmd-revive', store_id: store.id, product_id: product.id, quantity: 1, total_price: 10 },
  }, {});
  const id = outbox.forStore(store.id)[0].id;
  outbox.bury(id, 'connecteur retiré');

  assert.equal(integration.reviveDeadLetter(id), true);
  assert.equal(outbox.get(id).status, outbox.STATUS.PENDING);
  assert.equal(outbox.get(id).attempts, 0);

  await integration.drain();
  assert.equal(outbox.get(id).status, outbox.STATUS.SENT);
});

test('un message destiné à un connecteur disparu est classé sans réessai', () => {
  const { store } = storeWithManual();
  const { message } = outbox.enqueue({
    storeId: store.id,
    connectorId: 'connecteur-supprime-du-code',
    resource: 'order',
    operation: 'sale',
    payload: { entityId: 'x' },
    idempotencyKey: 'orphan-1',
  });

  sync.deliver(outbox.get(message.id));

  const after = outbox.get(message.id);
  assert.equal(after.status, outbox.STATUS.DEAD);
  assert.equal(after.attempts, 0, 'réessayer six fois une panne qui ne guérira pas noie les vraies');
});

/**
 * Fait échouer l'envoi du connecteur manuel le temps d'un scénario.
 *
 * Substitution locale plutôt qu'un connecteur de test dédié : ce qu'on veut éprouver est
 * le comportement du MOTEUR face à une panne, et le moteur doit se comporter pareil quel
 * que soit le connecteur. Un connecteur de test aurait pu diverger sans qu'on le sache.
 */
function withFailingPush(failure, body) {
  const manual = registry.get('manual');
  const original = manual.push;
  manual.push = failure;
  try {
    return body();
  } finally {
    manual.push = original;
  }
}

// ── 4. Transport entrant : déduplication, propriété, fraîcheur ────────────────

/** Un produit importé, avec sa correspondance : le décor de toute réception. */
function importedProduct({ mode } = {}) {
  const world = storeWithManual();
  integration.importCatalog({
    storeId: world.store.id, document: CATALOGUE_CSV, actor: world.merchant.id,
  });
  const product = catalog.findByReference(world.store.id, 'CAFE-001');
  if (mode) inventory.setInventoryOwner(product.id, mode);
  return { ...world, product };
}

function receiveStock({ store, reference = 'CAFE-001', onHand, key, sourceUpdatedAt = null }) {
  return integration.receive({
    connectorId: 'manual',
    storeId: store.id,
    resource: 'inventory',
    payload: { reference, quantity: onHand, sourceUpdatedAt },
    idempotencyKey: key,
    sourceUpdatedAt,
  });
}

test('un message reçu trois fois ne produit qu\'un effet', async () => {
  const { store, product } = importedProduct({ mode: inventory.INVENTORY_OWNER.POS });

  for (let i = 0; i < 3; i += 1) {
    receiveStock({ store, onHand: 42, key: 'stock-cafe-2026-07-25T10:00' });
  }

  assert.equal(inbox.forStore(store.id).length, 1, 'la déduplication vit en base, pas en mémoire');

  await integration.drain();
  assert.equal(inventory.getLevel(product.id).on_hand, 42);
  assert.equal(inventory.readMovements(product.id).filter((m) => m.origin === 'connector').length, 1);
});

test('en mode pos, le stock déclaré par le logiciel est repris', async () => {
  const { store, product } = importedProduct({ mode: inventory.INVENTORY_OWNER.POS });

  receiveStock({ store, onHand: 7, key: 'stock-pos-1' });
  await integration.drain();

  assert.equal(inventory.getLevel(product.id).on_hand, 7);
  assert.equal(h.read.stock(product.id), 7, 'la projection suit un stock miroir comme un autre');
});

test('en mode mazone, le stock proposé est refusé et le conflit est visible', async () => {
  const { store, product } = importedProduct();

  receiveStock({ store, onHand: 999, key: 'stock-refuse-1' });
  await integration.drain();

  assert.equal(inventory.getLevel(product.id).on_hand, 12, 'Ma Zone garde sa valeur');

  const [conflict] = integration.conflictsForStore(store.id);
  assert.equal(conflict.reason, integration.CONFLICT_REASON.OWNER_PRIORITY);
  assert.equal(conflict.attribute, 'on_hand');
  assert.equal(conflict.proposed_value, '999');
  assert.equal(conflict.retained_value, '12');
  // Le message est écrit pour un commerçant : il doit dire le geste qui débloquerait.
  assert.match(conflict.payload_summary, /Confiez la tenue du stock/);
});

test('un message sans produit correspondant devient un conflit, pas une panne', async () => {
  const { store } = importedProduct();

  receiveStock({ store, reference: 'INCONNU-999', onHand: 3, key: 'stock-inconnu' });
  await integration.drain();

  const [conflict] = integration.conflictsForStore(store.id);
  assert.equal(conflict.reason, integration.CONFLICT_REASON.UNMAPPED_ENTITY);
  // Rejeté, pas réessayé : un produit inconnu le restera jusqu'à un geste du commerçant.
  assert.equal(inbox.stats().rejected, 1);
  assert.equal(inbox.stats().received, 0);
});

test('un message en retard ne fait pas revenir le stock en arrière', async () => {
  const { store, product } = importedProduct({ mode: inventory.INVENTORY_OWNER.POS });

  receiveStock({ store, onHand: 20, key: 'frais', sourceUpdatedAt: '2026-07-25T12:00:00Z' });
  await integration.drain();
  receiveStock({ store, onHand: 3, key: 'en-retard', sourceUpdatedAt: '2026-07-25T09:00:00Z' });
  await integration.drain();

  assert.equal(inventory.getLevel(product.id).on_hand, 20);
  const [conflict] = integration.conflictsForStore(store.id);
  assert.equal(conflict.reason, integration.CONFLICT_REASON.STALE_TIMESTAMP);
});

test('un logiciel tiers ne peut jamais déclarer une réservation', async () => {
  const { store, product } = importedProduct({ mode: inventory.INVENTORY_OWNER.POS });
  integration.install({ storeId: store.id, connectorId: 'test_brut' });
  inventory.reserve({ productId: product.id, quantity: 2, reference: 'cmd-en-cours' });

  integration.receive({
    connectorId: 'test_brut',
    storeId: store.id,
    resource: 'inventory',
    payload: { externalId: 'CAFE-001', onHand: 5, reserved: 0 },
    idempotencyKey: 'stock-avec-reserved',
  });
  await integration.drain();

  assert.equal(inventory.getLevel(product.id).reserved, 2, 'aucune caisse ne sait ce que Ma Zone a promis');
  const [conflict] = integration.conflictsForStore(store.id);
  assert.equal(conflict.attribute, 'reserved');
  assert.equal(conflict.reason, integration.CONFLICT_REASON.OWNER_PRIORITY);
  // Refus AVANT toute écriture : le stock physique n'a pas bougé non plus.
  assert.equal(inventory.getLevel(product.id).on_hand, 12);
});

test('un logiciel tiers ne peut pas déclarer une disponibilité, qui se calcule', async () => {
  const { store } = importedProduct({ mode: inventory.INVENTORY_OWNER.POS });
  integration.install({ storeId: store.id, connectorId: 'test_brut' });

  integration.receive({
    connectorId: 'test_brut',
    storeId: store.id,
    resource: 'inventory',
    payload: { externalId: 'CAFE-001', onHand: 5, available: 5 },
    idempotencyKey: 'stock-avec-available',
  });
  await integration.drain();

  const [conflict] = integration.conflictsForStore(store.id);
  assert.equal(conflict.attribute, 'available');
  // Pas un conflit de données mais une erreur de conception du connecteur (Loi 11) : la
  // distinguer permet de dire à son auteur quoi corriger.
  assert.equal(conflict.reason, integration.CONFLICT_REASON.COMPUTED_FIELD);
});

test('un conflit acquitté ne remonte plus comme à traiter', async () => {
  const { store } = importedProduct();
  receiveStock({ store, onHand: 999, key: 'conflit-a-acquitter' });
  await integration.drain();

  const [conflict] = integration.conflictsForStore(store.id);
  assert.equal(integration.pendingConflicts(store.id), 1);
  assert.equal(integration.acknowledgeConflict(conflict.id), true);

  assert.equal(integration.pendingConflicts(store.id), 0);
  assert.equal(integration.conflictsForStore(store.id).length, 1, 'un conflit acquitté reste au journal');
});

// ── 5. Workers : un seul, et il le prouve ─────────────────────────────────────

test('un second worker sur la même file refuse de démarrer', () => {
  const first = worker.createWorker({ name: 'outbox', due: () => [], handle: () => {} });
  const second = worker.createWorker({ name: 'outbox', due: () => [], handle: () => {} });

  assert.equal(first.start().started, true);
  try {
    assert.throws(
      () => second.start(),
      // Deux workers sur la même file enverraient chaque vente deux fois chez l'éditeur.
      (err) => err.name === 'WorkerBusyError'
    );
  } finally {
    first.stop();
  }
});

test('un bail abandonné est repris par le worker suivant', () => {
  const abandonne = worker.createWorker({ name: 'outbox', due: () => [], handle: () => {} });
  assert.equal(abandonne.start().started, true);

  // Simule un processus tué sans libérer son bail : le battement de cœur s'arrête.
  h.db.prepare(`
    UPDATE integration_workers
    SET heartbeat_at = datetime('now', ?) WHERE name = 'outbox'
  `).run(`-${worker.LEASE_SECONDS * 3} seconds`);

  const repreneur = worker.createWorker({ name: 'outbox', due: () => [], handle: () => {} });
  try {
    assert.equal(
      repreneur.start().started, true,
      'un bail périmé doit être reprenable, sinon un kill -9 gèle la file pour toujours'
    );
  } finally {
    repreneur.stop();
    abandonne.stop();
  }
});

// ── 6. Les routes de l'écran « Mes intégrations » ─────────────────────────────

test('le commerçant voit ce que Ma Zone sait brancher', async () => {
  const { merchant } = h.seedWorld();
  const res = await h.api.get('/api/integration/connectors', { token: merchant.token });

  assert.equal(res.status, 200);
  const manual = res.body.connectors.find((c) => c.id === 'manual');
  assert.equal(manual.requiresAuth, false);
  assert.equal(manual.capabilities.includes('push_sales'), true);
});

test('un commerçant branche, importe et exporte depuis l\'API', async () => {
  const { store, merchant } = h.seedWorld();

  const installed = await h.api.post(
    `/api/integration/stores/${store.id}/connectors/manual`, {}, { token: merchant.token }
  );
  assert.equal(installed.status, 201);

  const inspected = await h.api.post(
    `/api/integration/stores/${store.id}/import/inspect`,
    { document: CATALOGUE_CSV }, { token: merchant.token }
  );
  assert.equal(inspected.status, 200);
  assert.equal(inspected.body.usable, true);
  assert.equal(inspected.body.lineCount, 3);

  const imported = await h.api.post(
    `/api/integration/stores/${store.id}/import`,
    { document: CATALOGUE_CSV }, { token: merchant.token }
  );
  assert.equal(imported.status, 200);
  assert.equal(imported.body.imported, 3);

  const state = await h.api.get(`/api/integration/stores/${store.id}`, { token: merchant.token });
  assert.equal(state.body.capabilities.includes('push_sales'), true);
});

test('l\'export des ventes rend une ligne par vente à recopier en caisse', async () => {
  const { store, merchant, client, product } = storeWithManual({ stock: 5 });

  await h.api.post('/api/orders', {
    product_id: product.id,
    quantity: 2,
    delivery_address: '6 rue de l\'Export',
  }, { token: client.token });

  const res = await h.api.get(
    `/api/integration/stores/${store.id}/export/sales`, { token: merchant.token }
  );

  assert.equal(res.status, 200);
  assert.equal(res.body.sales.length, 1);
  assert.equal(res.body.sales[0].quantite, 2);
  assert.equal(res.body.sales[0].operation, 'vente');
});

test('le commerçant voit ce qui n\'est jamais parti et peut le relancer', async () => {
  const { store, merchant, product } = storeWithManual();
  integration.pushSale({
    order: { id: 'cmd-dlq-api', store_id: store.id, product_id: product.id, quantity: 1, total_price: 10 },
  }, {});
  const message = outbox.forStore(store.id)[0];
  outbox.bury(message.id, 'logiciel du commerçant injoignable');

  const listed = await h.api.get(
    `/api/integration/stores/${store.id}/outbox/dead`, { token: merchant.token }
  );
  assert.equal(listed.status, 200);
  assert.equal(listed.body.dead.length, 1);

  const retried = await h.api.post(
    `/api/integration/stores/${store.id}/outbox/${message.id}/retry`, {}, { token: merchant.token }
  );
  assert.equal(retried.status, 200);
  assert.equal(outbox.get(message.id).status, outbox.STATUS.PENDING);
});

test('un commerçant ne peut pas relancer l\'envoi d\'une autre boutique', async () => {
  const { store, product } = storeWithManual();
  integration.pushSale({
    order: { id: 'cmd-autre', store_id: store.id, product_id: product.id, quantity: 1, total_price: 10 },
  }, {});
  const message = outbox.forStore(store.id)[0];
  outbox.bury(message.id, 'peu importe');

  const intrus = h.createUser({ role: 'merchant', name: 'Commerçant voisin' });
  const sienne = h.createStore({ merchantId: intrus.id, name: 'Boutique voisine' });

  const res = await h.api.post(
    `/api/integration/stores/${sienne.id}/outbox/${message.id}/retry`, {}, { token: intrus.token }
  );

  assert.equal(res.status, 404);
  assert.equal(outbox.get(message.id).status, outbox.STATUS.DEAD);
});

test('un commerçant ne voit pas les intégrations d\'une autre boutique', async () => {
  const { store } = storeWithManual();
  const intrus = h.createUser({ role: 'merchant', name: 'Autre commerçant' });

  const res = await h.api.get(`/api/integration/stores/${store.id}`, { token: intrus.token });

  // 404 et non 403 : répondre « interdit » confirmerait l'existence de la boutique.
  assert.equal(res.status, 404);
});

test('l\'administration voit la santé des files et le seuil Postgres', async () => {
  const { store, product } = storeWithManual();
  integration.pushSale({
    order: { id: 'cmd-admin', store_id: store.id, product_id: product.id, quantity: 1, total_price: 10 },
  }, {});

  const res = await h.api.get('/api/admin/integration/queues', { token: adminToken() });

  assert.equal(res.status, 200);
  assert.equal(res.body.outbox.pending, 1);
  // Le seuil de réexamen Postgres cesse d'être une phrase dans un document.
  assert.equal(res.body.postgresThreshold.reviewAbove, 200);
});

test('un token de commerçant n\'ouvre pas les files d\'administration', async () => {
  const { merchant } = h.seedWorld();
  const res = await h.api.get('/api/admin/integration/queues', { token: merchant.token });
  assert.equal(res.status, 401);
});

// ── 6 bis. Webhooks : la porte existe, et elle est fermée ─────────────────────

test('un webhook adressé à un connecteur sans vérification est refusé', async () => {
  const res = await h.api.post('/api/integration/webhooks/manual', { stock: 3 });

  // 501 : la mécanique existe, aucun connecteur ne sait encore prouver l'origine de ce
  // qu'il reçoit. Ouvrir la porte avant serait offrir l'écriture du stock à n'importe qui.
  assert.equal(res.status, 501);
  assert.equal(inbox.stats().received, 0);
});

test('un webhook adressé à un connecteur inconnu ne dit pas ce qui existe', async () => {
  const res = await h.api.post('/api/integration/webhooks/logiciel_imaginaire', {});
  assert.equal(res.status, 404);
});

test('un webhook vérifié est accepté en 202 et rejoué sans effet supplémentaire', async () => {
  const { store, product } = importedProduct({ mode: inventory.INVENTORY_OWNER.POS });

  // Un connecteur qui sait vérifier son origine — le seul cas où la porte s'ouvre.
  registry.register({
    id: 'test_webhook',
    label: 'Connecteur temps réel de test',
    capabilities: ['pull_inventory', 'webhooks'],
    pull: () => ({ items: [], nextCursor: null }),
    subscribeWebhooks: () => ({ subscribed: true }),
    // La signature est ici un en-tête convenu : ce qu'on éprouve est l'enchaînement de la
    // route, pas la cryptographie d'un éditeur.
    verifyWebhook: ({ headers, payload }) => (
      headers['x-signature-test'] === 'bonne-signature'
        ? {
          valid: true,
          storeId: payload.storeId,
          resource: 'inventory',
          payload: { externalId: payload.reference, onHand: payload.quantity },
          idempotencyKey: payload.eventId,
        }
        : { valid: false }
    ),
    toCanonical: (resource, external) => ({ ...external }),
  });
  integration.install({ storeId: store.id, connectorId: 'test_webhook' });
  bindings.bind({
    entityType: bindings.ENTITY_TYPE.PRODUCT,
    mazoneId: product.id,
    connectorId: 'test_webhook',
    externalId: 'CAFE-001',
  });

  const notification = { storeId: store.id, reference: 'CAFE-001', quantity: 6, eventId: 'evt-1' };
  const send = () => h.api.post('/api/integration/webhooks/test_webhook', notification, {
    headers: { 'x-signature-test': 'bonne-signature' },
  });

  const first = await send();
  const replay = await send();
  await send();

  assert.equal(first.status, 202, 'on accepte vite, on traite plus tard');
  assert.equal(first.body.duplicate, false);
  // 202 aussi sur le rejeu : répondre en erreur inciterait l'éditeur à réessayer sans fin.
  assert.equal(replay.status, 202);
  assert.equal(replay.body.duplicate, true);

  await integration.drain();
  assert.equal(inventory.getLevel(product.id).on_hand, 6);
  assert.equal(
    inventory.readMovements(product.id).filter((m) => m.origin === 'connector').length, 1,
    'trois notifications identiques, un seul effet'
  );

  const refused = await h.api.post('/api/integration/webhooks/test_webhook', notification, {
    headers: { 'x-signature-test': 'signature-forgee' },
  });
  // 401 et non 400 : la requête est bien formée, c'est son origine qui n'est pas prouvée.
  assert.equal(refused.status, 401);

  registry.forget('test_webhook');
});

/** Un administrateur actif et son jeton. Créé en base : la route de connexion n'est pas le sujet. */
function adminToken() {
  const { signAdminToken } = require('../src/middleware/adminAuth');
  const id = h.db.generateId();
  h.db.prepare(`
    INSERT INTO admin_users (id, email, password, name, level, active) VALUES (?, ?, ?, ?, ?, 1)
  `).run(id, `admin-${id}@test.mazone`, 'hash-non-utilise', 'Admin test', 'super');
  return signAdminToken({ id, email: `admin-${id}@test.mazone` });
}

// ── 7. Loi 16 : la frontière, vérifiée structurellement ──────────────────────

const SRC = path.join(__dirname, '..', 'src');

function jsFilesIn(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...jsFilesIn(full));
    else if (entry.name.endsWith('.js')) out.push(full);
  }
  return out;
}

/** Le contrôle porte sur le CODE : les commentaires de ces dossiers parlent forcément
 *  d'éditeurs et de webhooks, précisément pour dire qu'ils sont interdits ailleurs. */
function codeOf(file) {
  return fs.readFileSync(file, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/([^:])\/\/.*$/gm, '$1');
}

test('LOI 16 : aucun organe métier ne nomme un logiciel tiers', () => {
  const organs = ['orders', 'inventory', 'catalog', 'orchestration', 'kernel', 'cdm'];
  const offenders = [];

  for (const organ of organs) {
    const dir = path.join(SRC, 'lib', organ);
    if (!fs.existsSync(dir)) continue;

    for (const file of jsFilesIn(dir)) {
      const code = codeOf(file);
      if (/shopify|lightspeed|zettle|chift|square/i.test(code)) {
        offenders.push(`${path.relative(SRC, file)} nomme un éditeur`);
      }
      if (/fetch\s*\(|require\('axios'\)|node-fetch/.test(code)) {
        offenders.push(`${path.relative(SRC, file)} fait un appel réseau`);
      }
      if (/oauth|access_token|refresh_token|client_secret/i.test(code)) {
        offenders.push(`${path.relative(SRC, file)} manipule une authentification externe`);
      }
      if (/webhook/i.test(code)) {
        offenders.push(`${path.relative(SRC, file)} traite un webhook`);
      }
    }
  }

  assert.deepEqual(offenders, [], 'tout cela appartient exclusivement à l\'Integration Engine');
});

test('LOI 16 : aucun organe métier n\'importe l\'Integration Engine', () => {
  const organs = ['orders', 'inventory', 'catalog', 'orchestration', 'kernel', 'cdm', 'eventEngine'];
  const offenders = [];

  for (const organ of organs) {
    const dir = path.join(SRC, 'lib', organ);
    if (!fs.existsSync(dir)) continue;

    for (const file of jsFilesIn(dir)) {
      for (const [, required] of codeOf(file).matchAll(/require\('([^']+)'\)/g)) {
        // `adapters/integration` est l'exception, et c'est un EMPLACEMENT VIDE : il nomme
        // les opérations qui sortiront un jour de Ma Zone, sans les mettre en œuvre et sans
        // importer quoi que ce soit. C'est ce vide qui rend la substitution possible.
        if (/adapters\/integration$/.test(required)) continue;
        if (/integration|connector/i.test(required)) {
          offenders.push(`${path.relative(SRC, file)} importe « ${required} »`);
        }
      }
    }
  }

  // Le sens des dépendances EST la substitution progressive : l'Integration Engine
  // connaît l'orchestration et se déclare à elle. Jamais l'inverse.
  assert.deepEqual(offenders, [], 'la frontière de substitution est franchie');
});

test('LOI 2 : aucun connecteur n\'écrit dans une table métier', () => {
  const offenders = [];

  for (const file of jsFilesIn(path.join(SRC, 'lib', 'integration', 'connectors'))) {
    const code = codeOf(file);
    if (/INSERT INTO|UPDATE\s+(products|orders|stock_levels|users|stores)/i.test(code)) {
      offenders.push(`${path.basename(file)} écrit en base`);
    }
    for (const [, required] of code.matchAll(/require\('([^']+)'\)/g)) {
      // Un connecteur ne connaît que son propre dossier : ni organe, ni base, ni orchestration.
      if (!/^\.{1,2}\//.test(required) || /\/(db|orders|inventory|catalog|orchestration)/.test(required)) {
        offenders.push(`${path.basename(file)} importe « ${required} »`);
      }
    }
  }

  assert.deepEqual(offenders, [], 'un connecteur traduit et transporte ; il ne décide jamais');
});

test('LOI 16 : retirer le connecteur manuel ne casse aucun organe', () => {
  const { store, client, product } = storeWithManual({ stock: 5 });
  const manual = registry.get('manual');

  // Le connecteur disparaît du code, l'installation reste en base : c'est exactement l'état
  // d'un déploiement où un connecteur a été retiré sans nettoyer les boutiques.
  registry.forget('manual');
  try {
    assert.deepEqual(integration.capabilitiesForStore(store.id), []);

    const run = orchestration.run('order.place', {
      productId: product.id,
      quantity: 1,
      deliveryAddress: '7 rue de la Substitution',
    }, { actor: client.id, actorRole: 'client' });

    assert.ok(
      h.read.order(run.results['orders.create'].order.id),
      'un connecteur absent ne doit jamais empêcher de vendre'
    );
    assert.equal(run.report.some((r) => r.step === 'integration.pushSale'), true);
  } finally {
    registry.register(manual);
  }
});
