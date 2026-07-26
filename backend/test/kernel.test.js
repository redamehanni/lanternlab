/**
 * Étape 2 — critères de validation du noyau.
 *
 * Les quatre assertions qui comptent :
 *   1. Un fait émis dans une transaction annulée n'est JAMAIS délivré (Loi 7).
 *   2. Aucun effet n'a lieu pendant qu'une transaction est ouverte (Loi 7).
 *   3. Rejouer une clé d'idempotence renvoie le même résultat et n'écrit qu'une
 *      fois (Loi 10).
 *   4. Le journal est append-only et n'interprète rien (Loi 9).
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const h = require('./helpers/testServer');

const kernel = require('../src/lib/kernel');
const { bus, journal, idempotency, txn } = kernel;

test.beforeEach(() => {
  h.reset();
  bus.reset();
});

test.after(() => h.cleanup());

// ── Bus ───────────────────────────────────────────────────────────────────────

test('un abonné reçoit les faits de son canal', () => {
  const received = [];
  bus.subscribe('order.created', (fact) => received.push(fact));

  bus.emit('order.created', { orderId: 'cmd-1' });

  assert.equal(received.length, 1);
  assert.equal(received[0].channel, 'order.created');
  assert.equal(received[0].orderId, 'cmd-1');
});

test('un abonné « * » observe tous les faits', () => {
  const seen = [];
  bus.subscribe('*', (fact) => seen.push(fact.channel));

  bus.emit('order.created', {});
  bus.emit('inventory.reserved', {});

  assert.deepEqual(seen, ['order.created', 'inventory.reserved']);
});

test('le désabonnement fonctionne', () => {
  let count = 0;
  const unsubscribe = bus.subscribe('order.created', () => { count += 1; });

  bus.emit('order.created', {});
  unsubscribe();
  bus.emit('order.created', {});

  assert.equal(count, 1);
});

test('un canal qui ne nomme pas un fait au passé est refusé', () => {
  // `order.create` se lit comme un ordre, donc comme une décision que l'abonné
  // aurait le droit de prendre. Le nommage porte la Loi 8.
  assert.throws(() => bus.emit('OrderCreated', {}), /canal invalide/);
  assert.throws(() => bus.emit('order', {}), /canal invalide/);
  assert.throws(() => bus.subscribe('Order.Created', () => {}), /canal invalide/);
  // Ceux-ci sont valides.
  bus.emit('order.created', {});
  bus.emit('inventory.stock_adjusted', {});
});

test('l\'échec d\'un abonné n\'interrompt pas les autres', () => {
  const survivors = [];
  bus.subscribe('order.created', () => { throw new Error('abonné cassé'); });
  bus.subscribe('order.created', () => survivors.push('ok'));

  // Un abonné en échec ne doit pas annuler une vente qui a déjà eu lieu.
  assert.doesNotThrow(() => bus.emit('order.created', {}));
  assert.deepEqual(survivors, ['ok']);
});

// ── Transactions et ordre des effets (Loi 7) ───────────────────────────────────

test('les faits partent APRÈS le commit', () => {
  const observed = [];
  bus.subscribe('order.created', () => {
    // Au moment où l'abonné tourne, la transaction doit être refermée.
    observed.push({ inTransaction: txn.inTransaction() });
  });

  txn.run((ctx) => {
    ctx.publish('order.created', { orderId: 'cmd-1' });
    // Rien n'a encore été délivré à ce stade.
    assert.equal(observed.length, 0, 'aucun fait délivré pendant la transaction');
  });

  assert.equal(observed.length, 1);
  assert.equal(observed[0].inTransaction, false);
});

test('une transaction annulée ne délivre AUCUN fait', () => {
  const received = [];
  bus.subscribe('order.created', () => received.push('reçu'));

  assert.throws(() => {
    txn.run((ctx) => {
      ctx.publish('order.created', { orderId: 'cmd-1' });
      throw new Error('échec métier');
    });
  }, /échec métier/);

  // C'est le cœur de la Loi 7 : un client ne doit jamais recevoir « commande
  // créée » pour une commande qui n'existe pas.
  assert.deepEqual(received, []);
});

test('une transaction annulée n\'écrit rien en base', () => {
  const { store } = h.seedWorld({ stock: 5 });

  assert.throws(() => {
    txn.run(() => {
      h.db.prepare(
        'INSERT INTO products (id, store_id, name, price, quantity) VALUES (?, ?, ?, ?, ?)'
      ).run('prod-fantome', store.id, 'Fantôme', 1, 1);
      throw new Error('échec métier');
    });
  }, /échec métier/);

  assert.equal(h.read.product('prod-fantome'), undefined);
});

test('les effets différés respectent leur ordre d\'enregistrement', () => {
  const order = [];

  txn.run((ctx) => {
    ctx.after(() => order.push('premier'));
    ctx.publish('order.created', {});
    ctx.after(() => order.push('troisième'));
  });

  bus.subscribe('order.created', () => order.push('deuxième'));
  assert.deepEqual(order, ['premier', 'troisième'], 'ordre respecté');
});

test('un effet post-commit en échec ne remonte pas à l\'appelant', () => {
  // La décision est validée : un socket qui échoue ne peut plus l'annuler.
  let executed = false;
  assert.doesNotThrow(() => {
    txn.run((ctx) => {
      ctx.after(() => { throw new Error('socket injoignable'); });
      ctx.after(() => { executed = true; });
    });
  });
  assert.equal(executed, true, 'les effets suivants sont quand même exécutés');
});

test('un nom de canal invalide fait échouer la transaction, pas l\'émission', () => {
  // La faute de frappe doit être détectée avant le commit, pas après.
  assert.throws(() => {
    txn.run((ctx) => ctx.publish('OrderCreated', {}));
  }, /canal invalide/);
});

test('une transaction imbriquée rejoint celle du parent', () => {
  const received = [];
  bus.subscribe('order.created', () => received.push('reçu'));

  txn.run((outer) => {
    outer.publish('order.created', { niveau: 'externe' });
    txn.run((inner) => {
      inner.publish('order.created', { niveau: 'interne' });
      assert.equal(received.length, 0, 'rien n\'est délivré depuis l\'imbrication');
    });
  });

  assert.equal(received.length, 2, 'les deux faits partent au commit de la racine');
});

test('l\'annulation d\'une transaction imbriquée annule tout', () => {
  const received = [];
  bus.subscribe('order.created', () => received.push('reçu'));

  assert.throws(() => {
    txn.run((outer) => {
      outer.publish('order.created', {});
      txn.run(() => { throw new Error('échec interne'); });
    });
  }, /échec interne/);

  assert.deepEqual(received, []);
});

// ── Journal (Loi 9) ───────────────────────────────────────────────────────────

test('le journal écrit et relit dans l\'ordre', () => {
  const testJournal = journal.defineJournal({
    name: 'kernel_test',
    table: 'kernel_test_journal',
    subjectColumn: 'subject_id',
  });

  testJournal.append('sujet-1', { type: 'created', toStatus: 'placed', actor: 'client-1' });
  testJournal.append('sujet-1', { type: 'transitioned', fromStatus: 'placed', toStatus: 'delivered' });

  const entries = testJournal.read('sujet-1');
  assert.equal(entries.length, 2);
  assert.equal(entries[0].type, 'created');
  assert.equal(entries[1].from_status, 'placed');
});

test('le journal ne mélange pas les sujets', () => {
  const testJournal = journal.defineJournal({
    name: 'kernel_test',
    table: 'kernel_test_journal',
    subjectColumn: 'subject_id',
  });

  testJournal.append('sujet-1', { type: 'created' });
  testJournal.append('sujet-2', { type: 'created' });

  assert.equal(testJournal.read('sujet-1').length, 1);
  assert.equal(testJournal.read('sujet-2').length, 1);
});

test('le journal transporte la charge sans l\'interpréter', () => {
  const testJournal = journal.defineJournal({
    name: 'kernel_test',
    table: 'kernel_test_journal',
    subjectColumn: 'subject_id',
  });

  const payload = { reason: 'rupture', items: [1, 2, 3], nested: { ok: true } };
  testJournal.append('sujet-1', { type: 'cancelled', payload });

  assert.deepEqual(testJournal.read('sujet-1')[0].payload, payload);
});

test('le journal détecte une entrée déjà écrite', () => {
  const testJournal = journal.defineJournal({
    name: 'kernel_test',
    table: 'kernel_test_journal',
    subjectColumn: 'subject_id',
  });

  assert.equal(testJournal.has('sujet-1', 'created'), false);
  testJournal.append('sujet-1', { type: 'created' });
  assert.equal(testJournal.has('sujet-1', 'created'), true);
  assert.equal(testJournal.has('sujet-1', 'cancelled'), false);
});

test('une même clé d\'idempotence ne peut pas être journalisée deux fois', () => {
  const testJournal = journal.defineJournal({
    name: 'kernel_test',
    table: 'kernel_test_journal',
    subjectColumn: 'subject_id',
  });

  testJournal.append('sujet-1', { type: 'created', idempotencyKey: 'cle-1' });

  // Contrainte d'unicité en base : le garde-fou ne dépend pas du code appelant.
  assert.throws(
    () => testJournal.append('sujet-1', { type: 'created', idempotencyKey: 'cle-1' }),
    /UNIQUE/
  );
});

// ── Idempotence (Loi 10) ──────────────────────────────────────────────────────

test('rejouer une clé renvoie le premier résultat sans réexécuter', () => {
  let executions = 0;
  const operation = () => { executions += 1; return { orderId: `cmd-${executions}` }; };

  const first = idempotency.once('orders.create', 'cle-1', {}, operation);
  const second = idempotency.once('orders.create', 'cle-1', {}, operation);

  assert.equal(executions, 1, 'exécuté une seule fois');
  assert.equal(first.replayed, false);
  assert.equal(second.replayed, true);
  assert.deepEqual(second.result, first.result);
});

test('deux clés différentes exécutent deux fois', () => {
  let executions = 0;
  const operation = () => { executions += 1; return executions; };

  idempotency.once('orders.create', 'cle-1', {}, operation);
  idempotency.once('orders.create', 'cle-2', {}, operation);

  assert.equal(executions, 2);
});

test('la même clé dans deux périmètres différents n\'entre pas en collision', () => {
  let executions = 0;
  const operation = () => { executions += 1; return executions; };

  idempotency.once('orders.create', 'cle-1', {}, operation);
  idempotency.once('orders.cancel', 'cle-1', {}, operation);

  assert.equal(executions, 2);
});

test('sans clé, l\'opération s\'exécute normalement', () => {
  let executions = 0;
  idempotency.once('orders.create', null, {}, () => { executions += 1; });
  idempotency.once('orders.create', null, {}, () => { executions += 1; });
  assert.equal(executions, 2);
});

test('réutiliser une clé pour une requête différente est un conflit', () => {
  idempotency.once('orders.create', 'cle-1', { payload: { productId: 'A' } }, () => 'A');

  // C'est un bug d'appelant, pas un rejeu : le signaler valait mieux que
  // renvoyer silencieusement le résultat de la commande précédente.
  assert.throws(
    () => idempotency.once('orders.create', 'cle-1', { payload: { productId: 'B' } }, () => 'B'),
    /déjà été utilisée pour une requête différente/
  );
});

test('l\'empreinte est insensible à l\'ordre des clés', () => {
  assert.equal(
    idempotency.fingerprint({ a: 1, b: 2 }),
    idempotency.fingerprint({ b: 2, a: 1 })
  );
  assert.notEqual(
    idempotency.fingerprint({ a: 1 }),
    idempotency.fingerprint({ a: 2 })
  );
});

test('une clé enregistrée dans une transaction annulée ne bloque rien', () => {
  let executions = 0;

  assert.throws(() => {
    txn.run(() => {
      idempotency.once('orders.create', 'cle-annulee', {}, () => { executions += 1; return 'ok'; });
      throw new Error('échec après enregistrement');
    });
  }, /échec après/);

  // Sans cette propriété, un échec métier condamnerait définitivement la clé et
  // le client ne pourrait plus jamais réessayer sa commande.
  const retry = idempotency.once('orders.create', 'cle-annulee', {}, () => { executions += 1; return 'ok'; });
  assert.equal(retry.replayed, false);
  assert.equal(executions, 2);
});

test('une clé expirée est purgée', () => {
  idempotency.remember('orders.create', 'cle-vieille', { ok: true }, { ttlHours: -1 });

  assert.equal(idempotency.lookup('orders.create', 'cle-vieille'), null, 'invisible car expirée');
  assert.equal(idempotency.purgeExpired() >= 1, true);
});

// ── Non-régression du réexport ────────────────────────────────────────────────

test('eventEngine/bus reste utilisable et partage le bus du noyau', () => {
  const eventBus = require('../src/lib/eventEngine/bus');
  const received = [];

  // Un abonné inscrit via l'ancien chemin reçoit un fait émis par le noyau :
  // c'est bien le même bus, pas deux bus parallèles.
  eventBus.subscribe(eventBus.DOMAIN_EVENT.CREATED, (fact) => received.push(fact));
  bus.emit('event.created', { eventId: 'evt-1' });

  assert.equal(received.length, 1);
  assert.equal(received[0].eventId, 'evt-1');
});
