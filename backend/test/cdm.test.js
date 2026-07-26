/**
 * Étape 1 — critères de validation du CDM.
 *
 * Trois choses sont vérifiées ici, et ce sont exactement les trois qui font que le
 * CDM reste un vocabulaire au lieu de devenir un god object :
 *   1. Loi 4 — il n'accède jamais à la base.
 *   2. Loi 3 — tout attribut a un propriétaire déclaré, sinon le boot échoue.
 *   3. Il ne dérive pas du schéma réel.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const CDM_DIR = path.join(__dirname, '../src/lib/cdm');
const cdm = require('../src/lib/cdm');

// ── Loi 4 : vocabulaire, pas magasin ──────────────────────────────────────────

test('Loi 4 — aucun fichier du CDM n\'importe la base', () => {
  const offenders = [];
  for (const file of fs.readdirSync(CDM_DIR)) {
    if (!file.endsWith('.js')) continue;
    const source = fs.readFileSync(path.join(CDM_DIR, file), 'utf8');
    // On ignore les commentaires : ils PARLENT de la base, ils ne l'importent pas.
    const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    if (/require\(\s*['"][^'"]*\/db['"]\s*\)/.test(code)) offenders.push(file);
  }
  assert.deepEqual(offenders, []);
});

test('Loi 4 — charger le CDM n\'ouvre aucune base', () => {
  // Si le CDM importait `src/db`, un fichier SQLite apparaîtrait dans `data/`.
  // On le charge dans un process isolé avec un chemin de base inexistant : toute
  // ouverture de base créerait le fichier, ce qu'on détecte ensuite.
  const probe = path.join(__dirname, '..', 'data', `cdm-probe-${Date.now()}.db`);
  const result = spawnSync(
    process.execPath,
    ['-e', `require(${JSON.stringify(path.join(CDM_DIR, 'index.js'))})`],
    { env: { ...process.env, MAZONE_DB_PATH: probe }, encoding: 'utf8' }
  );

  assert.equal(result.status, 0, result.stderr);
  assert.equal(fs.existsSync(probe), false, 'aucune base ouverte');
});

// ── Loi 3 : chaque attribut a un propriétaire ─────────────────────────────────

test('le dictionnaire est cohérent', () => {
  assert.deepEqual(cdm.collectIssues(), []);
});

test('retirer une entrée de la matrice fait échouer le démarrage', () => {
  const { ENTITIES } = require('../src/lib/cdm/entities');
  const ownership = require('../src/lib/cdm/ownership');

  // On retire temporairement le rôle de `Order.status`, attribut critique.
  const removed = ownership.OWNERSHIP['Order.*'];
  delete ownership.OWNERSHIP['Order.*'];
  try {
    const issues = cdm.collectIssues();
    assert.ok(issues.length > 0, 'des problèmes sont signalés');
    assert.ok(
      issues.some((i) => i.includes('Order.status') && i.includes('Loi 3')),
      `un attribut sans propriétaire est signalé : ${issues.join(' | ')}`
    );
    assert.throws(() => cdm.assertConsistent(), /CDM incohérent/);
  } finally {
    ownership.OWNERSHIP['Order.*'] = removed;
  }
  assert.deepEqual(cdm.collectIssues(), [], 'état restauré');
  assert.ok(ENTITIES.Order, 'entités intactes');
});

test('la propriété du stock physique dépend du mode d\'inventaire', () => {
  const { roleOf } = cdm.ownership;

  // Commerçant sans caisse : Ma Zone tient le stock.
  assert.equal(roleOf('StockLevel', 'on_hand', { inventoryOwner: 'mazone' }), 'owner');
  // Commerçant avec caisse : la caisse décide, Ma Zone recopie.
  assert.equal(roleOf('StockLevel', 'on_hand', { inventoryOwner: 'pos' }), 'mirror');
});

test('les réservations appartiennent toujours à Ma Zone', () => {
  const { roleOf } = cdm.ownership;
  // Invariant qui empêche le double décrément : aucune caisse ne sait ce que Ma
  // Zone a promis à un client.
  for (const mode of ['mazone', 'pos']) {
    assert.equal(roleOf('StockLevel', 'reserved', { inventoryOwner: mode }), 'owner');
  }
});

test('Loi 11 — une valeur dérivable n\'est jamais écrivable', () => {
  const { isWritable, isCalculated } = cdm.ownership;

  assert.equal(isCalculated('StockLevel', 'available'), true);
  assert.equal(isWritable('StockLevel', 'available'), false);
  // `products.quantity` devient une projection : personne ne doit prendre
  // l'habitude de l'écrire directement.
  assert.equal(isCalculated('Product', 'quantity'), true);
  assert.equal(isWritable('Product', 'quantity'), false);
});

// ── Validation de forme ───────────────────────────────────────────────────────

test('une commande bien formée est acceptée', () => {
  const order = {
    id: 'cmd-1',
    client_id: 'user-1',
    product_id: 'prod-1',
    store_id: 'store-1',
    quantity: 2,
    total_price: 24,
    status: 'pending_driver',
  };
  assert.deepEqual(cdm.check('Order', order, { partial: true }).issues, []);
});

test('un statut hors énumération est refusé', () => {
  const result = cdm.check('Order', { status: 'teleportee' }, { partial: true });
  assert.equal(result.valid, false);
  assert.match(result.issues[0], /hors énumération/);
});

test('un champ inconnu est refusé', () => {
  const result = cdm.check('Order', { couleur_preferee: 'bleu' }, { partial: true });
  assert.equal(result.valid, false);
  assert.match(result.issues[0], /n'existe pas dans le CDM/);
});

test('écrire un attribut calculé est refusé', () => {
  const result = cdm.check('StockLevel', { available: 7 }, { partial: true });
  assert.equal(result.valid, false);
  assert.match(result.issues[0], /calculé/);
});

test('un champ obligatoire manquant est refusé hors mode partiel', () => {
  const result = cdm.check('Order', { id: 'cmd-1' });
  assert.equal(result.valid, false);
  assert.ok(result.issues.some((i) => i.includes('client_id')));
});

test('un type invalide est refusé', () => {
  const result = cdm.check('Order', { quantity: 'deux' }, { partial: true });
  assert.equal(result.valid, false);
  assert.match(result.issues[0], /type invalide/);
});
