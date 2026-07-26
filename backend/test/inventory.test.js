/**
 * Étape 4 — organe Inventory.
 *
 * Le test qui compte le plus est celui de CONCURRENCE. Le triple état n'existe pas
 * pour la beauté du modèle : il existe parce que `products.quantity` était lu puis
 * décrémenté par un `UPDATE` séparé, et que deux ventes simultanées sur la dernière
 * unité passaient toutes les deux. Ce test n'est pas optionnel.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const h = require('./helpers/testServer');

const inventory = require('../src/lib/inventory');
const { computeAvailable } = require('../src/lib/inventory/policy');

test.beforeEach(() => h.reset());

test.after(async () => {
  await h.stopServer();
  h.cleanup();
});

// ── Le calcul ─────────────────────────────────────────────────────────────────

test('LOI 11 : available se calcule et ne descend jamais sous zéro', () => {
  assert.equal(computeAvailable({ on_hand: 10, reserved: 3, safety_buffer: 2 }), 5);
  // Un `on_hand` corrigé à la baisse pendant que des réservations existent donne un
  // négatif. Un négatif affiché au client serait pire qu'un zéro.
  assert.equal(computeAvailable({ on_hand: 1, reserved: 5, safety_buffer: 0 }), 0);
});

test('la table n\'a pas de colonne available', () => {
  const columns = h.db.prepare('PRAGMA table_info(stock_levels)').all().map((c) => c.name);
  assert.ok(!columns.includes('available'), 'available ne doit jamais être stocké');
});

// ── Adoption paresseuse ───────────────────────────────────────────────────────

test('un produit jamais touché est adopté à sa première lecture d\'état', () => {
  const { product } = h.seedWorld({ stock: 7 });
  assert.equal(inventory.getLevel(product.id), null, 'aucune ligne au départ');

  const level = inventory.ensureLevel(product.id);

  assert.equal(level.on_hand, 7, 'le compteur historique devient le stock physique');
  assert.equal(level.reserved, 0);
  assert.equal(level.available, 7);
});

test('la lecture de disponibilité ne crée aucune ligne', () => {
  const { product } = h.seedWorld({ stock: 4 });

  assert.equal(inventory.getSellableQty(product.id), 4);
  assert.equal(inventory.getLevel(product.id), null, 'une lecture n\'écrit pas');
});

// ── Réserver, libérer, consommer ──────────────────────────────────────────────

test('réserver baisse la disponibilité sans toucher au stock physique', () => {
  const { product } = h.seedWorld({ stock: 5 });

  const level = inventory.reserve({ productId: product.id, quantity: 2, reference: 'cmd-1' });

  assert.equal(level.on_hand, 5, 'la marchandise est toujours en rayon');
  assert.equal(level.reserved, 2);
  assert.equal(level.available, 3);
  assert.equal(h.read.stock(product.id), 3, 'la projection suit available');
});

test('réserver plus que disponible est un 409 et n\'écrit rien', () => {
  const { product } = h.seedWorld({ stock: 2 });

  assert.throws(
    () => inventory.reserve({ productId: product.id, quantity: 5 }),
    (err) => err.name === 'InsufficientStockError' && err.status === 409
  );

  // « N'écrit rien » au sens le plus strict : même la ligne de stock créée au vol
  // pour évaluer la demande a disparu avec la transaction annulée.
  assert.equal(inventory.getLevel(product.id), null);
  assert.equal(h.read.stock(product.id), 2);
});

test('la réserve de sécurité retire des unités de la vente sans les faire disparaître', () => {
  const { product } = h.seedWorld({ stock: 5 });

  const level = inventory.setSafetyBuffer(product.id, 2);

  assert.equal(level.on_hand, 5);
  assert.equal(level.available, 3);
  assert.throws(
    () => inventory.reserve({ productId: product.id, quantity: 4 }),
    (err) => err.status === 409
  );
});

test('libérer rend exactement ce qui était réservé pour la référence', () => {
  const { product } = h.seedWorld({ stock: 5 });
  inventory.reserve({ productId: product.id, quantity: 2, reference: 'cmd-1' });

  const level = inventory.release({ productId: product.id, quantity: 2, reference: 'cmd-1' });

  assert.equal(level.reserved, 0);
  assert.equal(level.available, 5);
});

test('libérer deux fois la même réservation est refusé', () => {
  const { product } = h.seedWorld({ stock: 5 });
  inventory.reserve({ productId: product.id, quantity: 2, reference: 'cmd-1' });
  inventory.release({ productId: product.id, quantity: 2, reference: 'cmd-1' });

  // Sans ce garde-fou, une double annulation créerait du stock qui n'existe pas.
  assert.throws(
    () => inventory.release({ productId: product.id, quantity: 2, reference: 'cmd-1' }),
    (err) => err.status === 409
  );
  assert.equal(inventory.getLevel(product.id).on_hand, 5);
});

test('libérer une réservation d\'une AUTRE commande est refusé', () => {
  const { product } = h.seedWorld({ stock: 5 });
  inventory.reserve({ productId: product.id, quantity: 3, reference: 'cmd-1' });

  assert.throws(
    () => inventory.release({ productId: product.id, quantity: 3, reference: 'cmd-2' }),
    (err) => err.status === 409
  );
});

test('consommer une réservation fait sortir la marchandise', () => {
  const { product } = h.seedWorld({ stock: 5 });
  inventory.reserve({ productId: product.id, quantity: 2, reference: 'cmd-1' });

  const level = inventory.commit({ productId: product.id, quantity: 2, reference: 'cmd-1' });

  assert.equal(level.on_hand, 3, 'la marchandise a quitté le rayon');
  assert.equal(level.reserved, 0);
  assert.equal(level.available, 3);
});

// ── Mode pos : le miroir ──────────────────────────────────────────────────────

test('en mode pos, consommer ne touche pas au stock physique', () => {
  const { product } = h.seedWorld({ stock: 5 });
  inventory.setInventoryOwner(product.id, inventory.INVENTORY_OWNER.POS);
  inventory.reserve({ productId: product.id, quantity: 2, reference: 'cmd-1' });

  const level = inventory.commit({ productId: product.id, quantity: 2, reference: 'cmd-1' });

  // La caisse détient la vérité physique et l'annoncera par syncOnHand. Décrémenter
  // ici produirait un double décrément : c'est le bug numéro un des intégrations.
  assert.equal(level.on_hand, 5);
  assert.equal(level.reserved, 0);
});

test('en mode pos, une correction locale du stock physique est refusée', () => {
  const { product } = h.seedWorld({ stock: 5 });
  inventory.setInventoryOwner(product.id, inventory.INVENTORY_OWNER.POS);

  assert.throws(
    () => inventory.adjust({ productId: product.id, delta: 3 }),
    (err) => err.status === 409
  );
});

test('en mode pos, les réservations restent la propriété de Ma Zone', () => {
  const { product } = h.seedWorld({ stock: 5 });
  inventory.setInventoryOwner(product.id, inventory.INVENTORY_OWNER.POS);

  const level = inventory.reserve({ productId: product.id, quantity: 2, reference: 'cmd-1' });

  assert.equal(level.reserved, 2, 'aucune caisse ne sait ce que Ma Zone a promis');
});

// ── Propriété des écritures ───────────────────────────────────────────────────

test('un connecteur ne peut RIEN faire d\'autre que déclarer le stock physique', () => {
  const { product } = h.seedWorld({ stock: 5 });
  const origin = inventory.MOVEMENT_ORIGIN.CONNECTOR;
  inventory.setInventoryOwner(product.id, inventory.INVENTORY_OWNER.POS);

  const level = inventory.syncOnHand({ productId: product.id, onHand: 12, origin });
  assert.equal(level.on_hand, 12);

  assert.throws(
    () => inventory.adjust({ productId: product.id, delta: 1, origin }),
    (err) => err.status === 403
  );
});

/**
 * Étape 6 — la propriété du stock ne se prend pas, elle se donne.
 *
 * Ce test documente un changement de comportement assumé. À l'étape 4, `syncOnHand`
 * acceptait n'importe quelle origine : aucun connecteur n'existait, la question était
 * théorique. Elle ne l'est plus, et la matrice de propriété est formelle — en mode
 * `mazone`, une valeur venue d'ailleurs est un conflit, pas une mise à jour.
 */
test('en mode mazone, un connecteur ne peut pas écraser le stock physique', () => {
  const { product } = h.seedWorld({ stock: 5 });

  assert.throws(
    () => inventory.syncOnHand({
      productId: product.id, onHand: 99, origin: inventory.MOVEMENT_ORIGIN.CONNECTOR,
    }),
    (err) => err.status === 409 && err.ownership === 'mazone'
  );

  assert.equal(h.read.stock(product.id), 5, 'le refus doit être total, pas partiel');
});

test('déclarer le stock physique ne touche jamais aux réservations', () => {
  const { product } = h.seedWorld({ stock: 5 });
  inventory.reserve({ productId: product.id, quantity: 2, reference: 'cmd-1' });

  const level = inventory.syncOnHand({
    productId: product.id, onHand: 10, origin: inventory.MOVEMENT_ORIGIN.MERCHANT,
  });

  assert.equal(level.reserved, 2);
  assert.equal(level.available, 8);
});

// ── Journal des mouvements ────────────────────────────────────────────────────

test('chaque mouvement est journalisé avec l\'état résultant', () => {
  const { product } = h.seedWorld({ stock: 5 });
  inventory.reserve({ productId: product.id, quantity: 2, reference: 'cmd-1' });
  inventory.commit({ productId: product.id, quantity: 2, reference: 'cmd-1' });

  const movements = inventory.readMovements(product.id);
  assert.deepEqual(movements.map((m) => m.kind), ['reserve', 'commit']);
  assert.equal(movements[0].reserved_after, 2);
  assert.equal(movements[0].on_hand_after, 5);
  assert.equal(movements[1].reserved_after, 0);
  assert.equal(movements[1].on_hand_after, 3);
  assert.equal(movements[1].reference, 'cmd-1');
});

test('la projection reste juste après chaque mouvement', () => {
  const { product } = h.seedWorld({ stock: 10 });

  const steps = [
    () => inventory.reserve({ productId: product.id, quantity: 3, reference: 'a' }),
    () => inventory.reserve({ productId: product.id, quantity: 2, reference: 'b' }),
    () => inventory.release({ productId: product.id, quantity: 3, reference: 'a' }),
    () => inventory.commit({ productId: product.id, quantity: 2, reference: 'b' }),
    () => inventory.adjust({ productId: product.id, delta: -1 }),
    () => inventory.syncOnHand({
      productId: product.id, onHand: 20, origin: inventory.MOVEMENT_ORIGIN.MERCHANT,
    }),
  ];

  for (const step of steps) {
    const level = step();
    assert.equal(h.read.stock(product.id), level.available, 'projection désynchronisée');
  }
  assert.deepEqual(inventory.findProjectionDrift(), []);
});

// ── Concurrence : le test qui justifie l'étape ────────────────────────────────

test('deux commandes simultanées sur la dernière unité : une passe, l\'autre reçoit 409', async () => {
  const { client, product } = h.seedWorld({ stock: 1 });

  const [first, second] = await Promise.all([
    h.api.post('/api/orders', { product_id: product.id, quantity: 1 }, { token: client.token }),
    h.api.post('/api/orders', { product_id: product.id, quantity: 1 }, { token: client.token }),
  ]);

  const codes = [first.status, second.status].sort();
  assert.deepEqual(codes, [201, 409], 'exactement une commande doit aboutir');
  assert.equal(h.read.orders().length, 1);
  assert.equal(h.read.stock(product.id), 0, 'jamais de stock négatif');
  assert.equal(inventory.getLevel(product.id).reserved, 1);
});

test('dix commandes simultanées sur cinq unités : cinq passent, cinq échouent', async () => {
  const { client, product } = h.seedWorld({ stock: 5 });

  const results = await Promise.all(
    Array.from({ length: 10 }, () =>
      h.api.post('/api/orders', { product_id: product.id, quantity: 1 }, { token: client.token })
    )
  );

  assert.equal(results.filter((r) => r.status === 201).length, 5);
  assert.equal(results.filter((r) => r.status === 409).length, 5);
  assert.equal(inventory.getLevel(product.id).reserved, 5);
  assert.equal(h.read.stock(product.id), 0);
});

// ── Bout en bout, chemin d'adoption A ─────────────────────────────────────────

test('un commerçant sans connecteur crée un produit, saisit son stock et vend', async () => {
  const merchant = h.createUser({ role: 'merchant', name: 'Commerçant seul' });
  const store = h.createStore({ merchantId: merchant.id });
  const client = h.createUser({ role: 'client', name: 'Cliente' });

  const created = await h.api.post(
    '/api/products',
    { name: 'Pain', price: 3, quantity: 4 },
    { token: merchant.token }
  );
  assert.equal(created.status, 201);
  const productId = created.body.product.id;
  assert.equal(created.body.product.store_id, store.id);
  assert.equal(created.body.product.quantity, 4, 'le stock déclaré à la création est vendable');

  const restocked = await h.api.patch(
    `/api/products/${productId}/stock`,
    { delta: 2 },
    { token: merchant.token }
  );
  assert.equal(restocked.body.product.quantity, 6);

  const ordered = await h.api.post(
    '/api/orders',
    { product_id: productId, quantity: 2 },
    { token: client.token }
  );
  assert.equal(ordered.status, 201);
  assert.equal(h.read.stock(productId), 4);

  const stock = await h.api.get(`/api/products/${productId}/stock`, { token: merchant.token });
  assert.equal(stock.body.stock.on_hand, 6, 'la marchandise est encore en boutique');
  assert.equal(stock.body.stock.reserved, 2);
  assert.equal(stock.body.stock.available, 4);
});

test('réenregistrer le stock affiché ne fait pas fondre le stock', async () => {
  const { merchant, product, client } = h.seedWorld({ stock: 5 });
  await h.api.post('/api/orders', { product_id: product.id, quantity: 2 }, { token: client.token });
  assert.equal(h.read.stock(product.id), 3);

  // Le commerçant voit 3 à l'écran et réenregistre 3 sans rien changer. Interpréter
  // ce nombre comme un stock physique ferait disparaître les 2 unités réservées.
  await h.api.patch(`/api/products/${product.id}/stock`, { quantity: 3 }, { token: merchant.token });

  assert.equal(h.read.stock(product.id), 3, 'le vendable est inchangé');
  assert.equal(inventory.getLevel(product.id).on_hand, 5, 'la marchandise réservée est préservée');
});

test('LOI 12 : l\'état de stock détaillé est réservé au commerçant de la boutique', async () => {
  const { product, client } = h.seedWorld({ stock: 5 });
  const autre = h.createUser({ role: 'merchant', name: 'Concurrent' });
  h.createStore({ merchantId: autre.id, name: 'Concurrente' });

  assert.equal((await h.api.get(`/api/products/${product.id}/stock`, { token: client.token })).status, 403);
  assert.equal((await h.api.get(`/api/products/${product.id}/stock`, { token: autre.token })).status, 404);
});

// ── Reprise T0 ────────────────────────────────────────────────────────────────

test('la reprise reconstitue les réservations des commandes en cours', () => {
  const { client, product } = h.seedWorld({ stock: 5 });

  // On simule l'état d'avant l'étape 4 : la commande existe et `products.quantity`
  // a déjà été décrémenté, mais aucune ligne de stock n'a jamais été créée.
  const orderId = h.db.generateId();
  h.db.prepare(`
    INSERT INTO orders (id, client_id, product_id, store_id, quantity, total_price, status)
    VALUES (?, ?, ?, (SELECT store_id FROM products WHERE id = ?), 2, 20, 'pending_driver')
  `).run(orderId, client.id, product.id, product.id);
  h.db.prepare('UPDATE products SET quantity = 3 WHERE id = ?').run(product.id);
  h.db.prepare('DELETE FROM stock_levels WHERE product_id = ?').run(product.id);

  const report = inventory.backfill();

  assert.ok(report.adopted >= 1);
  assert.equal(report.reservationsRebuilt, 1);

  const level = inventory.getLevel(product.id);
  assert.equal(level.on_hand, 5, 'la réservation est ressortie du stock physique');
  assert.equal(level.reserved, 2);
  assert.equal(level.available, 3, 'l\'affichage ne change pas d\'une unité');
  assert.equal(h.read.stock(product.id), 3);

  // Et surtout : la commande d'avant la migration est maintenant annulable.
  assert.equal(inventory.reservedFor(orderId, product.id), 2);
});

test('la reprise est idempotente', () => {
  const { product } = h.seedWorld({ stock: 5 });
  inventory.ensureLevel(product.id);

  const report = inventory.backfill();

  assert.equal(report.adopted, 0);
  assert.ok(report.skipped >= 1);
});

test('une dérive de projection est détectée puis réparée', () => {
  const { product } = h.seedWorld({ stock: 5 });
  inventory.ensureLevel(product.id);

  // Écriture sauvage, telle qu'un ancien code aurait pu la faire.
  h.db.prepare('UPDATE products SET quantity = 99 WHERE id = ?').run(product.id);

  const drift = inventory.findProjectionDrift();
  assert.equal(drift.length, 1);
  assert.deepEqual(drift[0], { productId: product.id, projected: 99, computed: 5 });

  inventory.repairProjectionDrift();
  assert.deepEqual(inventory.findProjectionDrift(), []);
  assert.equal(h.read.stock(product.id), 5);
});

// ── Loi vérifiée sur le code source ───────────────────────────────────────────

test('LOI 11 : un seul fichier du backend écrit products.quantity', () => {
  const root = path.join(__dirname, '..', 'src');
  const offenders = [];

  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.js')) {
        const source = fs.readFileSync(full, 'utf8');
        if (/UPDATE products SET quantity/i.test(source)) {
          offenders.push(path.relative(root, full));
        }
      }
    }
  };
  walk(root);

  assert.deepEqual(offenders, ['lib/inventory/stockLevels.js']);
});

test('LOI 1 : l\'organe Inventory ne connaît ni commande ni logiciel tiers', () => {
  const dir = path.join(__dirname, '..', 'src', 'lib', 'inventory');
  for (const file of fs.readdirSync(dir)) {
    const source = fs.readFileSync(path.join(dir, file), 'utf8');
    assert.ok(
      !/require\(.*orders/.test(source),
      `${file} importe l'organe Orders — l'inventaire ne sait pas ce qu'est une vente`
    );
    assert.ok(!/shopify|lightspeed|zettle/i.test(source), `${file} nomme un logiciel tiers`);
  }
});
