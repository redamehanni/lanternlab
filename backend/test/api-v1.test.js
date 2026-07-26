/**
 * Étape 7 — l'API v1 et son contrat.
 *
 * Quatre critères de validation sont posés par la roadmap, et ils sont tous ici :
 *
 *   1. un test de contrat vérifie CHAQUE route contre l'OpenAPI ;
 *   2. AUCUNE réponse client ne contient `on_hand` — balayage automatisé ;
 *   3. une intention appelée sans `Idempotency-Key` renvoie 400 ;
 *   4. la surface historique reste intacte pendant la bascule.
 *
 * Le premier mérite un mot. Un test de contrat qui ne vérifie qu'un sens — « les routes
 * documentées existent » — laisse passer le cas le plus fréquent : la route ajoutée
 * discrètement, jamais documentée, sur laquelle un intégrateur finit par s'appuyer sans
 * garantie. Le balayage va donc dans les deux sens.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const h = require('./helpers/testServer');

const v1 = require('../src/routes/v1');
const sunset = require('../src/lib/sunset');
const inventory = require('../src/lib/inventory');
const integration = require('../src/lib/integration');
const projections = require('../src/routes/v1/projections');

const SPEC_PATH = path.join(__dirname, '../openapi/openapi.yaml');
const spec = yaml.load(fs.readFileSync(SPEC_PATH, 'utf8'));

test.before(async () => { await h.startServer(); });
test.beforeEach(() => h.reset());
test.after(async () => { await h.stopServer(); h.cleanup(); });

/** Clé d'idempotence unique — un test ne doit jamais rejouer celle d'un autre. */
let keyCounter = 0;
function key(label = 'test') {
  keyCounter += 1;
  return `${label}-idem-${Date.now()}-${keyCounter}`;
}

// ── 1. Contrat : les routes réelles et le document se correspondent ────────────

test('CONTRAT : chaque route servie est documentée, et réciproquement', () => {
  const real = new Set(v1.operations().map((op) => `${op.method} ${op.path}`));

  const documented = new Set();
  for (const [routePath, operations] of Object.entries(spec.paths)) {
    for (const method of Object.keys(operations)) {
      documented.add(`${method.toUpperCase()} ${routePath}`);
    }
  }

  const undocumented = [...real].filter((op) => !documented.has(op));
  const phantom = [...documented].filter((op) => !real.has(op));

  assert.deepEqual(
    undocumented, [],
    'routes servies mais absentes du contrat — un intégrateur s\'appuierait sur du non-garanti'
  );
  assert.deepEqual(
    phantom, [],
    'routes promises par le contrat mais inexistantes — le document mentirait'
  );
  assert.equal(real.size, 19, 'la surface a changé de taille : mettre à jour le contrat ET ce compte');
});

test('CONTRAT : les champs interdits au client sont bien absents du schéma publié', () => {
  // La liste blanche du code et le schéma du document doivent dire la même chose. Si l'un
  // des deux dérive, la protection devient déclarative d'un côté et fictive de l'autre.
  const product = spec.components.schemas.ProductPublic;

  assert.equal(product.additionalProperties, false);
  for (const forbidden of projections.CLIENT_FORBIDDEN) {
    assert.equal(
      Object.keys(product.properties).includes(forbidden), false,
      `${forbidden} ne doit pas figurer dans le schéma client`
    );
  }
  assert.ok(product.properties.available);
});

// ── 2. Aucune fuite de stock physique vers un acheteur ────────────────────────

/**
 * Décor minimal : une boutique avec un produit dont le stock physique dépasse le
 * vendable. Sans cet écart, une fuite serait indétectable — les deux nombres seraient
 * égaux et un test passerait en lisant le mauvais champ.
 */
function world({ onHand = 12, reserved = 0, buffer = 3 } = {}) {
  const w = h.seedWorld({ stock: onHand });
  inventory.ensureLevel(w.product.id, null, { onHand });
  inventory.setSafetyBuffer(w.product.id, buffer);
  if (reserved) {
    inventory.reserve({
      productId: w.product.id, quantity: reserved,
      reference: `res-${w.product.id}`, actor: w.client.id,
    });
  }
  return w;
}

test('un client lit available, jamais on_hand', async () => {
  const { product, client } = world({ onHand: 12, buffer: 3 });

  const res = await h.api.get(`/api/v1/products/${product.id}`, { token: client.token });

  assert.equal(res.status, 200);
  assert.equal(res.body.product.available, 9, '12 physiques − 3 de réserve');
  assert.equal('on_hand' in res.body.product, false);
  assert.equal('quantity' in res.body.product, false);
});

test('AUCUNE réponse client de /api/v1 ne contient de champ de gestion de stock', async () => {
  const { store, product, client } = world({ onHand: 12, reserved: 2, buffer: 3 });

  // Toutes les routes qu'un rôle `client` peut atteindre. La liste est explicite plutôt
  // que déduite : une route ajoutée doit obliger quelqu'un à se demander « qui la lit ? ».
  const clientRoutes = [
    '/api/v1/stores',
    `/api/v1/stores/${store.id}`,
    `/api/v1/stores/${store.id}/products`,
    `/api/v1/products/${product.id}`,
    '/api/v1/orders/mine',
    '/api/v1/intents',
    '/api/v1/integrations',
  ];

  for (const route of clientRoutes) {
    const res = await h.api.get(route, { token: client.token });
    assert.equal(res.status, 200, `${route} devrait répondre 200`);

    // Balayage récursif : la fuite arrive presque toujours par un objet imbriqué.
    //
    // Sur les quatre champs de GESTION seulement, et pas sur `quantity`. La première
    // version de ce test balayait aussi `quantity` et signalait `GET /api/v1/intents`, où
    // c'est le nom d'un paramètre d'intention — la quantité commandée. Une règle qui crie
    // pour rien finit désactivée : celle-ci ne crie que sur des noms sans second sens.
    const found = [];
    const walk = (node, at) => {
      if (node === null || typeof node !== 'object') return;
      if (Array.isArray(node)) return node.forEach((item, i) => walk(item, `${at}[${i}]`));
      for (const [k, v] of Object.entries(node)) {
        if (projections.MANAGEMENT_STOCK_FIELDS.includes(k)) found.push(`${at}.${k}`);
        walk(v, `${at}.${k}`);
      }
    };
    walk(res.body, route);

    assert.deepEqual(found, [], `${route} laisse fuir du stock de gestion`);
  }
});

test('aucune fiche produit client ne porte quantity, alias ambigu de available', async () => {
  const { store, product, client } = world({ onHand: 12, buffer: 3 });

  const one = await h.api.get(`/api/v1/products/${product.id}`, { token: client.token });
  const list = await h.api.get(`/api/v1/stores/${store.id}/products`, { token: client.token });

  // Sur un produit — et là seulement — `quantity` serait un second nom du vendable. Deux
  // noms pour la même valeur, c'est l'ambiguïté que l'étape 4 a mis un mois à dissiper.
  for (const fiche of [one.body.product, ...list.body.products]) {
    assert.equal('quantity' in fiche, false);
    assert.equal(typeof fiche.available, 'number');
  }
});

test('le garde de projection refuse une réponse client contaminée', () => {
  // Éprouve le filet lui-même : une liste blanche mal écrite doit être arrêtée par le
  // garde, faute de quoi la promesse « structurellement impossible » n'est qu'un mot.
  assert.throws(
    () => projections.guard({ products: [{ name: 'Café', on_hand: 12 }] }),
    /fuite de projection.*on_hand/s
  );
  // Une commande porte légitimement `quantity` : c'est la quantité commandée. Le garde ne
  // doit donc pas être appliqué aveuglément — la nuance est testée pour rester vraie.
  assert.doesNotThrow(() => projections.orderForParty({ id: 'o1', quantity: 2 }));
});

// ── 3. Idempotence obligatoire sur les intentions ─────────────────────────────

test('une intention sans Idempotency-Key renvoie 400', async () => {
  const { product, client } = world();

  const res = await h.api.post('/api/v1/intents/order.place', {
    params: { productId: product.id, quantity: 1, deliveryAddress: '3 rue du Contrat' },
  }, { token: client.token });

  assert.equal(res.status, 400);
  assert.match(res.body.error, /Idempotency-Key/);
  assert.equal(h.read.orders().length, 0, 'rien ne doit avoir été créé');
});

test('une Idempotency-Key trop courte est refusée', async () => {
  const { product, client } = world();

  const res = await h.api.post('/api/v1/intents/order.place', {
    params: { productId: product.id, quantity: 1 },
  }, { token: client.token, headers: { 'Idempotency-Key': 'court' } });

  assert.equal(res.status, 400);
});

test('la même clé rejouée ne vend qu\'une fois', async () => {
  const { product, client } = world({ onHand: 12, buffer: 0 });
  const idem = key('vente');

  const send = () => h.api.post('/api/v1/intents/order.place', {
    params: { productId: product.id, quantity: 2, deliveryAddress: '3 rue du Rejeu' },
  }, { token: client.token, headers: { 'Idempotency-Key': idem } });

  const first = await send();
  const replay = await send();

  assert.equal(first.status, 201, 'première exécution');
  // `partially_completed` et non `completed` : aucun connecteur n'est branché dans ce
  // décor, donc la remontée en caisse est reportée. C'est le comportement attendu, et le
  // test voisin l'éprouve pour lui-même.
  assert.equal(first.body.status, 'partially_completed');
  assert.ok(first.body.result['orders.create'].order.id, 'la vente a bien eu lieu');
  assert.equal(replay.status, 200, 'rejeu : 200, pour que l\'appelant sache que rien n\'est neuf');
  assert.equal(replay.body.replayed, true);
  assert.equal(replay.body.run_id, first.body.run_id, 'même exécution, pas une seconde');

  assert.equal(h.read.orders().length, 1, 'une seule commande');
  assert.equal(inventory.getLevel(product.id).reserved, 2, 'un seul stock réservé');
});

test('une intention dont une étape externe manque aboutit et le dit', async () => {
  const { product, client } = world({ onHand: 5, buffer: 0 });

  const res = await h.api.post('/api/v1/intents/order.place', {
    params: { productId: product.id, quantity: 1, deliveryAddress: '3 rue de la Loi 12' },
  }, { token: client.token, headers: { 'Idempotency-Key': key('report') } });

  assert.equal(res.status, 201);
  // La vente aboutit sans connecteur branché, et ce qui n'a pas pu être fait est nommé.
  assert.equal(res.body.status, 'partially_completed');
  const pushed = res.body.deferred.find((d) => d.step === 'integration.pushSale');
  assert.ok(pushed, 'l\'étape externe doit être rapportée');
  assert.equal(pushed.reason, 'capability_missing');
  assert.equal(pushed.capability, 'push_sales');
});

test('une intention refusée par un organe ne laisse rien derrière elle', async () => {
  const { product, client } = world({ onHand: 2, buffer: 0 });

  const res = await h.api.post('/api/v1/intents/order.place', {
    params: { productId: product.id, quantity: 99, deliveryAddress: '3 rue du Refus' },
  }, { token: client.token, headers: { 'Idempotency-Key': key('refus') } });

  assert.equal(res.status, 409, 'stock insuffisant : conflit d\'état, pas erreur de forme');
  assert.equal(res.body.status, 'failed');
  assert.equal(h.read.orders().length, 0);
  assert.equal(inventory.getLevel(product.id).reserved, 0);
});

test('un rôle qui n\'est pas acteur d\'une intention est refusé', async () => {
  const { product, driver } = world();

  const res = await h.api.post('/api/v1/intents/order.place', {
    params: { productId: product.id, quantity: 1 },
  }, { token: driver.token, headers: { 'Idempotency-Key': key('livreur') } });

  assert.equal(res.status, 403);
});

test('le plan d\'une intention est lisible avant de la déclencher', async () => {
  const { client } = world();

  const res = await h.api.get('/api/v1/intents/order.place', { token: client.token });

  assert.equal(res.status, 200);
  const steps = res.body.intent.steps.map((s) => s.step);
  assert.deepEqual(steps, ['orders.create', 'dispatch.findDriver', 'integration.pushSale']);
  // Loi 16 : une étape qui sort de Ma Zone se conditionne à une capacité abstraite, jamais
  // à un logiciel nommé.
  const external = res.body.intent.steps.find((s) => s.step === 'integration.pushSale');
  assert.equal(external.requires, 'push_sales');
  assert.equal(external.optional, true);
});

test('le déroulé d\'une exécution est lisible par son auteur, et par personne d\'autre', async () => {
  const { product, client } = world({ onHand: 5, buffer: 0 });
  const other = h.createUser({ role: 'client', name: 'Curieux' });

  const run = await h.api.post('/api/v1/intents/order.place', {
    params: { productId: product.id, quantity: 1, deliveryAddress: '3 rue du Journal' },
  }, { token: client.token, headers: { 'Idempotency-Key': key('journal') } });

  const mine = await h.api.get(`/api/v1/intents/runs/${run.body.run_id}`, { token: client.token });
  const theirs = await h.api.get(`/api/v1/intents/runs/${run.body.run_id}`, { token: other.token });

  assert.equal(mine.status, 200);
  assert.ok(mine.body.steps.length >= 2);
  assert.equal(theirs.status, 404, '404 et non 403 : ne pas confirmer que l\'exécution existe');
});

// ── 4. Projection boutique : les quatre valeurs, et l'accès ───────────────────

test('la boutique voit les quatre valeurs de son stock', async () => {
  const { product, merchant } = world({ onHand: 12, reserved: 2, buffer: 3 });

  const res = await h.api.get(`/api/v1/inventory/${product.id}`, { token: merchant.token });

  assert.equal(res.status, 200);
  assert.deepEqual(
    {
      on_hand: res.body.stock.on_hand,
      reserved: res.body.stock.reserved,
      safety_buffer: res.body.stock.safety_buffer,
      available: res.body.stock.available,
    },
    { on_hand: 12, reserved: 2, safety_buffer: 3, available: 7 }
  );
  assert.equal(res.body.stock.inventory_owner, 'mazone');
});

test('un commerçant étranger à la boutique reçoit 404, pas 403', async () => {
  const { product } = world();
  const outsider = h.createUser({ role: 'merchant', name: 'Concurrent' });

  const stock = await h.api.get(`/api/v1/inventory/${product.id}`, { token: outsider.token });
  const movements = await h.api.get(`/api/v1/inventory/${product.id}/movements`, { token: outsider.token });

  // 403 confirmerait qu'un produit existe sous cet identifiant, ce qui suffit à
  // cartographier le catalogue d'un concurrent.
  assert.equal(stock.status, 404);
  assert.equal(movements.status, 404);
});

test('un client ne peut pas lire l\'inventaire d\'une boutique', async () => {
  const { product, client } = world();

  const res = await h.api.get(`/api/v1/inventory/${product.id}`, { token: client.token });

  assert.equal(res.status, 403, 'route réservée au rôle commerçant');
});

test('un produit jamais adopté par l\'organe répond une vérité utilisable', async () => {
  const merchant = h.createUser({ role: 'merchant' });
  const store = h.createStore({ merchantId: merchant.id });
  const product = h.createProduct({ storeId: store.id, quantity: 4 });

  const res = await h.api.get(`/api/v1/inventory/${product.id}`, { token: merchant.token });

  assert.equal(res.status, 200);
  assert.equal(res.body.adopted, false, 'aucune ligne de stock : dit, pas caché');
  assert.equal(res.body.stock.on_hand, 4);
  // Un GET ne doit pas écrire : la lecture ne crée pas la ligne.
  assert.equal(inventory.getLevel(product.id), null);
});

test('l\'inventaire d\'une boutique se liste en une requête', async () => {
  const { store, merchant, product } = world({ onHand: 12, buffer: 3 });

  const res = await h.api.get(`/api/v1/inventory?store_id=${store.id}`, { token: merchant.token });

  assert.equal(res.status, 200);
  assert.equal(res.body.levels.length, 1);
  assert.equal(res.body.levels[0].product_id, product.id);
  assert.equal(res.body.levels[0].available, 9);
});

// ── 5. PATCH déclaratif : la promesse faite à l'étape 4 ───────────────────────

test('le commerçant déclare du PHYSIQUE, et le vendable s\'en déduit', async () => {
  const { product, merchant } = world({ onHand: 12, reserved: 2, buffer: 3 });

  const res = await h.api.patch(`/api/v1/inventory/${product.id}`, { on_hand: 20 }, {
    token: merchant.token,
  });

  assert.equal(res.status, 200);
  assert.equal(res.body.stock.on_hand, 20, 'la valeur déclarée est du physique, prise telle quelle');
  assert.equal(res.body.stock.reserved, 2, 'une déclaration de physique ne touche pas les promesses');
  assert.equal(res.body.stock.available, 15, '20 − 2 − 3');
});

test('déclarer deux fois la même valeur laisse le stock identique', async () => {
  const { product, merchant } = world({ onHand: 12, reserved: 2, buffer: 0 });

  await h.api.patch(`/api/v1/inventory/${product.id}`, { on_hand: 10 }, { token: merchant.token });
  const second = await h.api.patch(`/api/v1/inventory/${product.id}`, { on_hand: 10 }, {
    token: merchant.token,
  });

  // C'est ce qui dispense cette route d'une clé d'idempotence : le corps est déclaratif.
  // L'ancienne API, qui devinait que le nombre saisi était du vendable, faisait fondre le
  // stock à chaque enregistrement — ici, non.
  assert.equal(second.body.stock.on_hand, 10);
  assert.equal(second.body.stock.available, 8);
});

test('le tampon de sécurité se règle sans toucher au physique', async () => {
  const { product, merchant } = world({ onHand: 12, buffer: 0 });

  const res = await h.api.patch(`/api/v1/inventory/${product.id}`, { safety_buffer: 4 }, {
    token: merchant.token,
  });

  assert.equal(res.body.stock.on_hand, 12);
  assert.equal(res.body.stock.safety_buffer, 4);
  assert.equal(res.body.stock.available, 8);
});

test('un PATCH vide est refusé', async () => {
  const { product, merchant } = world();

  const res = await h.api.patch(`/api/v1/inventory/${product.id}`, {}, { token: merchant.token });

  assert.equal(res.status, 400);
});

test('en mode miroir, Ma Zone refuse de corriger le physique — et ne touche à rien', async () => {
  const { product, merchant } = world({ onHand: 12, buffer: 1 });
  inventory.setInventoryOwner(product.id, inventory.INVENTORY_OWNER.POS);

  const res = await h.api.patch(`/api/v1/inventory/${product.id}`, {
    on_hand: 99, safety_buffer: 7,
  }, { token: merchant.token });

  assert.equal(res.status, 409);
  const level = inventory.getLevel(product.id);
  assert.equal(level.on_hand, 12, 'le physique appartient à la caisse');
  // Le refus a lieu AVANT toute écriture : sans ce contrôle préalable, le tampon aurait
  // été écrit puis le physique refusé, laissant une modification à moitié faite.
  assert.equal(level.safety_buffer, 1, 'aucune écriture partielle');
});

// ── 6. Commandes, livraisons, intégrations ───────────────────────────────────

test('une commande n\'est lisible que par ses parties prenantes', async () => {
  const { product, client, merchant } = world({ onHand: 5, buffer: 0 });
  const stranger = h.createUser({ role: 'client', name: 'Tiers' });

  const run = await h.api.post('/api/v1/intents/order.place', {
    params: { productId: product.id, quantity: 1, deliveryAddress: '3 rue des Parties' },
  }, { token: client.token, headers: { 'Idempotency-Key': key('acces') } });
  const orderId = run.body.result['orders.create'].order.id;

  const asClient = await h.api.get(`/api/v1/orders/${orderId}`, { token: client.token });
  const asMerchant = await h.api.get(`/api/v1/orders/${orderId}`, { token: merchant.token });
  const asStranger = await h.api.get(`/api/v1/orders/${orderId}`, { token: stranger.token });

  assert.equal(asClient.status, 200);
  assert.equal(asMerchant.status, 200);
  assert.equal(asStranger.status, 404);
  assert.equal(asClient.body.order.product.name, product.name, 'la fiche est lisible sans seconde requête');
});

test('le journal d\'une commande raconte ce qui lui est arrivé', async () => {
  const { product, client } = world({ onHand: 5, buffer: 0 });

  const run = await h.api.post('/api/v1/intents/order.place', {
    params: { productId: product.id, quantity: 1, deliveryAddress: '3 rue du Récit' },
  }, { token: client.token, headers: { 'Idempotency-Key': key('bio') } });
  const orderId = run.body.result['orders.create'].order.id;

  const res = await h.api.get(`/api/v1/orders/${orderId}/journal`, { token: client.token });

  assert.equal(res.status, 200);
  assert.ok(res.body.journal.length >= 1);
  assert.ok(res.body.journal.every((e) => e.type && e.created_at));
});

test('la boutique liste ses commandes, une autre boutique non', async () => {
  const { store, product, client, merchant } = world({ onHand: 5, buffer: 0 });
  const outsider = h.createUser({ role: 'merchant', name: 'Concurrent' });

  await h.api.post('/api/v1/intents/order.place', {
    params: { productId: product.id, quantity: 1, deliveryAddress: '3 rue de la Liste' },
  }, { token: client.token, headers: { 'Idempotency-Key': key('liste') } });

  const mine = await h.api.get(`/api/v1/orders?store_id=${store.id}`, { token: merchant.token });
  const theirs = await h.api.get(`/api/v1/orders?store_id=${store.id}`, { token: outsider.token });
  const noScope = await h.api.get('/api/v1/orders', { token: merchant.token });

  assert.equal(mine.status, 200);
  assert.equal(mine.body.orders.length, 1);
  assert.equal(theirs.status, 404);
  assert.equal(noScope.status, 400, 'sans store_id, la question n\'a pas de sens');
});

test('le livreur lit ses courses et sa course active', async () => {
  const { product, client, driver } = world({ onHand: 5, buffer: 0 });
  h.db.prepare('UPDATE users SET driver_online = 1 WHERE id = ?').run(driver.id);

  await h.api.post('/api/v1/intents/order.place', {
    params: { productId: product.id, quantity: 1, deliveryAddress: '3 rue de la Course' },
  }, { token: client.token, headers: { 'Idempotency-Key': key('course') } });

  const res = await h.api.get('/api/v1/deliveries/mine', { token: driver.token });

  assert.equal(res.status, 200);
  assert.ok(Array.isArray(res.body.deliveries));
  // Le décor est en mode proposition (20 s) : la course peut être offerte sans être encore
  // acceptée. On éprouve donc la FORME de la réponse, pas l'issue du dispatch, qui a ses
  // propres tests.
  assert.equal('active' in res.body, true);
  for (const delivery of res.body.deliveries) {
    assert.ok(delivery.order_id);
    assert.equal(typeof delivery.earnings, 'number');
  }
});

test('les capacités d\'une boutique sont publiées, pas devinées', async () => {
  const { store, merchant } = world();

  const before = await h.api.get(`/api/v1/integrations?store_id=${store.id}`, {
    token: merchant.token,
  });
  assert.equal(before.status, 200);
  assert.deepEqual(before.body.capabilities, [], 'rien de branché : aucune capacité');
  const manual = before.body.connectors.find((c) => c.id === 'manual');
  assert.ok(manual, 'le connecteur manuel est proposé');
  assert.equal(manual.connected, false);

  integration.install({ storeId: store.id, connectorId: 'manual', actor: merchant.id });

  const after = await h.api.get(`/api/v1/integrations?store_id=${store.id}`, {
    token: merchant.token,
  });
  assert.equal(after.body.connectors.find((c) => c.id === 'manual').connected, true);
  assert.ok(after.body.capabilities.includes('push_sales'));
});

test('une boutique étrangère ne lit ni les intégrations ni les conflits', async () => {
  const { store } = world();
  const outsider = h.createUser({ role: 'merchant', name: 'Concurrent' });

  const integrations = await h.api.get(`/api/v1/integrations?store_id=${store.id}`, {
    token: outsider.token,
  });
  const conflicts = await h.api.get(`/api/v1/integrations/manual/conflicts?store_id=${store.id}`, {
    token: outsider.token,
  });

  assert.equal(integrations.status, 404);
  assert.equal(conflicts.status, 404);
});

// ── 7. Deux API en parallèle : la dette est bornée dans le code ───────────────

test('la surface historique reste intacte pendant la bascule', async () => {
  const { product, client } = world({ onHand: 5, buffer: 0 });

  // Le critère central de la coexistence : `/api` continue de fonctionner, sans clé
  // d'idempotence, avec sa forme de réponse à elle. Une application déjà installée sur
  // un téléphone ne se met pas à jour parce qu'on a livré une v1.
  const legacy = await h.api.post('/api/orders', {
    product_id: product.id, quantity: 1, delivery_address: '3 rue de l\'Histoire',
  }, { token: client.token });

  assert.equal(legacy.status, 201);
  assert.ok(legacy.body.order.id);
  assert.equal(h.read.product(product.id).quantity, 4, 'products.quantity reste à jour');
});

test('/api s\'annonce dépréciée, /api/v1 ne s\'annonce pas mourante', async () => {
  const { client, store } = world();
  const { baseUrl } = await h.startServer();

  const legacy = await fetch(`${baseUrl}/api/stores`, {
    headers: { Authorization: `Bearer ${client.token}` },
  });
  const versioned = await fetch(`${baseUrl}/api/v1/stores/${store.id}`, {
    headers: { Authorization: `Bearer ${client.token}` },
  });

  assert.equal(legacy.headers.get('deprecation'), 'true');
  assert.ok(legacy.headers.get('sunset'), 'RFC 8594 : la date de mort est dans la réponse');
  assert.match(legacy.headers.get('link') || '', /successor-version/);

  assert.equal(versioned.headers.get('deprecation'), null, 'la surface neuve n\'est pas dépréciée');
  assert.equal(versioned.headers.get('mazone-api-version'), 'v1');
});

test('l\'usage des routes historiques est comptabilisé par motif de route', async () => {
  const { client, store } = world();
  sunset.resetUsage();

  await h.api.get('/api/stores', { token: client.token });
  await h.api.get('/api/stores', { token: client.token });
  await h.api.get(`/api/v1/stores/${store.id}`, { token: client.token });

  const usage = sunset.legacyUsage();
  const stores = usage.routes.find((r) => r.route === 'GET /api/stores');

  assert.ok(stores, 'la route historique est comptée');
  assert.equal(stores.calls, 2);
  // Compter les URL brutes ferait grandir la table indéfiniment — un identifiant par
  // ligne — et transformerait un compteur en fuite de mémoire.
  assert.equal(usage.routes.some((r) => r.route.includes(store.id)), false);
  assert.equal(usage.routes.some((r) => r.route.includes('/api/v1')), false, 'v1 n\'est pas legacy');
});

test('les échéances de suppression sont inscrites, datées, et pas encore passées', () => {
  // CE TEST EST UN RÉVEIL, PAS UNE VÉRIFICATION.
  //
  // Il échouera le 31/01/2027, puis le 30/04/2027. Ce n'est pas un défaut : c'est le seul
  // moyen qu'une intention de suppression survive à six mois de travail sur autre chose.
  // Le jour où il casse, la conversation à avoir est dans `entry.decision`, et la réponse
  // « qui appelle encore /api ? » est dans GET /api/admin/api-usage.
  const overdue = sunset.schedule().filter((entry) => entry.overdue);

  assert.deepEqual(
    overdue.map((e) => `${e.what} — échéance ${e.date} : ${e.decision}`), [],
    'une échéance est dépassée : il faut décider, pas repousser en silence'
  );

  // L'ordre est une contrainte, pas une préférence : `products.quantity` est lu par les
  // écrans que sert `/api`. Le supprimer avant afficherait « 0 en stock » sur des
  // produits disponibles.
  assert.ok(
    sunset.deadlineOf('productsQuantity') > sunset.deadlineOf('legacyApi'),
    'la projection ne peut pas mourir avant l\'API qui la lit'
  );
});

test('le socket annonce available sans cesser d\'annoncer quantity', async () => {
  const { product, client } = world({ onHand: 5, buffer: 0 });
  const { io } = await h.startServer();

  const emitted = [];
  const realEmit = io.emit.bind(io);
  io.emit = (event, payload) => {
    if (event === 'product:stock_updated') emitted.push(payload);
    return realEmit(event, payload);
  };

  try {
    await h.api.post('/api/v1/intents/order.place', {
      params: { productId: product.id, quantity: 1, deliveryAddress: '3 rue du Socket' },
    }, { token: client.token, headers: { 'Idempotency-Key': key('socket') } });
  } finally {
    io.emit = realEmit;
  }

  assert.equal(emitted.length, 1);
  assert.equal(emitted[0].available, 4, 'le nom juste est là');
  // Et l'ancien aussi : les sept écrans client qui lisent `quantity` n'ont pas changé
  // d'une ligne. Ajouter un champ est sans risque, en renommer un aurait cassé des
  // applications déjà installées.
  assert.equal(emitted[0].quantity, 4);
});

test('une route inconnue de /api/v1 répond en JSON, pas en HTML', async () => {
  const { client } = world();

  const res = await h.api.get('/api/v1/nimportequoi', { token: client.token });

  assert.equal(res.status, 404);
  assert.match(res.body.error, /Route inconnue/);
  assert.ok(res.body.hint.includes('openapi'), 'on indique où lire le contrat');
});
