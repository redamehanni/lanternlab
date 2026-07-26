/**
 * Étape 1 — anti-dérive entre le CDM et le schéma réel.
 *
 * Un dictionnaire qui décrit une base qui n'existe plus est pire qu'aucun
 * dictionnaire : il fait prendre des décisions sur une fiction. Ce test compare les
 * entités `live` du CDM au schéma SQLite effectif.
 *
 * Il est délibérément ASYMÉTRIQUE :
 *   - un champ déclaré au CDM et absent de la base est une ERREUR (le CDM ment) ;
 *   - une colonne en base et absente du CDM est TOLÉRÉE (le CDM est un
 *     vocabulaire métier, pas un miroir exhaustif du stockage — il n'a aucune
 *     raison de nommer `password` ou `photo_url`).
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const h = require('./helpers/testServer');
const cdm = require('../src/lib/cdm');
const { TYPES } = require('../src/lib/cdm/types');

test.after(() => h.cleanup());

function columnsOf(table) {
  return h.db.prepare(`PRAGMA table_info(${table})`).all();
}

function tableExists(table) {
  return !!h.db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?")
    .get(table);
}

test('chaque entité live a bien sa table', () => {
  for (const name of cdm.liveEntities()) {
    const { table } = cdm.ENTITIES[name];
    assert.equal(tableExists(table), true, `${name} → table ${table} absente`);
  }
});

test('chaque champ live déclaré existe en base', () => {
  const missing = [];

  for (const name of cdm.liveEntities()) {
    const entity = cdm.ENTITIES[name];
    const actual = new Set(columnsOf(entity.table).map((c) => c.name));
    for (const field of Object.keys(entity.fields)) {
      if (!actual.has(field)) missing.push(`${name}.${field} (table ${entity.table})`);
    }
  }

  assert.deepEqual(missing, [], 'le CDM déclare des champs qui n\'existent pas');
});

test('les types déclarés sont compatibles avec les colonnes SQLite', () => {
  const mismatches = [];

  for (const name of cdm.liveEntities()) {
    const entity = cdm.ENTITIES[name];
    const columns = new Map(columnsOf(entity.table).map((c) => [c.name, c.type.toUpperCase()]));

    for (const [fieldName, field] of Object.entries(entity.fields)) {
      const columnType = columns.get(fieldName);
      if (!columnType) continue; // déjà signalé par le test précédent
      const accepted = TYPES[field.type].sqlite;
      if (!accepted.some((t) => columnType.startsWith(t))) {
        mismatches.push(
          `${name}.${fieldName} : CDM ${field.type} (${accepted.join('|')}) vs SQLite ${columnType}`
        );
      }
    }
  }

  assert.deepEqual(mismatches, []);
});

test('les entités planifiées n\'ont pas encore de table', () => {
  // Sert d'indicateur d'avancement : le jour où `stock_levels` existe, ce test
  // rappelle que `StockLevel` doit passer de `planned` à `live`.
  const unexpected = [];

  for (const name of cdm.ENTITY_NAMES) {
    const entity = cdm.ENTITIES[name];
    if (entity.status !== 'planned') continue;
    if (tableExists(entity.table)) {
      unexpected.push(`${name} : la table ${entity.table} existe — passer le statut à « live »`);
    }
  }

  assert.deepEqual(unexpected, []);
});

test('les statuts de commande du CDM couvrent ceux de lib/orderStatus', () => {
  const { ORDER_STATUS } = require('../src/lib/orderStatus');
  const declared = new Set(cdm.ENTITIES.Order.fields.status.values);

  for (const status of Object.values(ORDER_STATUS)) {
    assert.equal(declared.has(status), true, `statut « ${status} » absent du CDM`);
  }
});

test('la table d\'une entité canonique peut porter un autre nom', () => {
  // `Delivery` s'appelle `missions` en base : le CDM assume le renommage plutôt
  // que d'imposer une migration de table pour une question de vocabulaire.
  assert.equal(cdm.ENTITIES.Delivery.table, 'missions');
  assert.equal(cdm.entityForTable('missions'), 'Delivery');
});
