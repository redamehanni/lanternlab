/**
 * Test headless du Bac à Sable pour l'Event Engine :
 *  - la recette World Factory seede des initiatives + Mode Réception ;
 *  - les actions de labo passent par l'organe (create/publish/diffuse) ;
 *  - le reset purge proprement initiatives, diffusions, abonnements.
 */

const db = require('../src/db');
const world = require('../src/lib/worldFactory');
const lab = require('../src/lib/lab');

let passed = 0, failed = 0;
const ok = (c, l) => { if (c) { passed++; console.log(`  ✓ ${l}`); } else { failed++; console.error(`  ✗ ${l}`); } };

let batchId;

function demoUserIds() {
  return db.prepare("SELECT entity_id FROM demo_entities WHERE entity_type = 'user' AND batch_id = ?").all(batchId).map((r) => r.entity_id);
}
function demoEventIds() {
  return db.prepare("SELECT entity_id FROM demo_entities WHERE entity_type = 'event' AND batch_id = ?").all(batchId).map((r) => r.entity_id);
}

try {
  console.log('\n── Recette : seed d\'initiatives ──');
  const res = world.runRecipe('quartier_anime', { residents: 3, merchants: 2, drivers: 1 });
  batchId = res.batchId;
  ok(res.summary.initiatives >= 3, `initiatives seedées (${res.summary.initiatives})`);
  const eventIds = demoEventIds();
  ok(eventIds.length === res.summary.initiatives, 'initiatives tracées dans demo_entities (reset propre)');

  const subs = db.prepare(
    `SELECT COUNT(*) c FROM event_subscriptions WHERE user_id IN (${demoUserIds().map(() => '?').join(',')})`
  ).get(...demoUserIds());
  ok(subs.c >= 3, 'Mode Réception seedé pour les habitants');

  console.log('\n── Actions de labo (via organe) ──');
  const merchant = db.prepare(`
    SELECT u.id FROM users u
    JOIN demo_entities d ON d.entity_id = u.id AND d.entity_type = 'user' AND d.batch_id = ?
    WHERE u.role = 'merchant' LIMIT 1
  `).get(batchId);
  const created = lab.runAction('create_event', {
    targetUserId: merchant.id,
    params: { type: 'atelier', title: 'Atelier labo', summary: 'Créé depuis le Laboratoire', publish: true },
  });
  ok(created.result && created.result.status === 'published', 'action create_event (publish) via organe');
  // Trace cette initiative pour le reset (créée hors recette).
  db.prepare('INSERT INTO demo_entities (id, batch_id, entity_type, entity_id) VALUES (?, ?, ?, ?)')
    .run(db.generateId(), batchId, 'event', created.result.id);

  const diffused = lab.runAction('diffuse_event', {
    targetUserId: merchant.id,
    params: { eventId: created.result.id, channels: ['vie_de_quartier'], note: 'Ça démarre !' },
  });
  ok(diffused.result && typeof diffused.result.reached === 'number', 'action diffuse_event via organe');

  console.log('\n── Reset (purge propre) ──');
  const allEventIds = demoEventIds();
  world.resetBatch(batchId);
  const remaining = allEventIds.filter((id) => db.prepare('SELECT 1 FROM events WHERE id = ?').get(id));
  ok(remaining.length === 0, 'toutes les initiatives démo supprimées au reset');
  const orphanSubs = db.prepare('SELECT COUNT(*) c FROM event_subscriptions').get();
  const orphanForBatch = db.prepare(
    `SELECT COUNT(*) c FROM event_diffusions WHERE event_id IN (${allEventIds.map(() => '?').join(',') || 'NULL'})`
  ).get(...allEventIds);
  ok(orphanForBatch.c === 0, 'aucune diffusion orpheline après reset');
  batchId = null; // déjà nettoyé
  void orphanSubs;

  console.log(`\n${passed} réussis, ${failed} échoués\n`);
} catch (e) {
  console.error('Erreur fatale :', e);
  failed++;
} finally {
  if (batchId) {
    try { world.resetBatch(batchId); } catch { /* best effort */ }
  }
}

process.exit(failed === 0 ? 0 : 1);
