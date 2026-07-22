/**
 * Test headless du hook interne (Phase 5) : les abonnés observent les faits de
 * domaine sans impacter le cœur, et une erreur d'abonné reste isolée.
 */

const db = require('../src/db');
const events = require('../src/lib/eventEngine');
const bus = require('../src/lib/eventEngine/bus');

let passed = 0, failed = 0;
const ok = (c, l) => { if (c) { passed++; console.log(`  ✓ ${l}`); } else { failed++; console.error(`  ✗ ${l}`); } };

const createdEvents = [];
function cleanup() {
  for (const id of createdEvents) {
    db.prepare('DELETE FROM event_journal WHERE event_id = ?').run(id);
    db.prepare('DELETE FROM events WHERE id = ?').run(id);
  }
}

try {
  console.log('\n── Abonné insights (stats) ──');
  const before = events.getInsights();
  const beforePublished = before.counters['event.published'] || 0;

  const ev = events.createEvent({ type: 'atelier', sourceKind: 'citizen', title: 'Balade nature' });
  createdEvents.push(ev.id);
  events.publishEvent(ev.id, { actor: 'x' });

  const after = events.getInsights();
  ok((after.counters['event.published'] || 0) === beforePublished + 1, 'compteur event.published incrémenté');
  ok(after.recent[0] && after.recent[0].fact === 'event.published', 'fil d\'activité mis à jour');

  console.log('\n── Isolation défensive ──');
  let coreSurvived = false;
  const unsub = bus.subscribe(bus.DOMAIN_EVENT.CREATED, () => { throw new Error('abonné défaillant'); });
  const ev2 = events.createEvent({ type: 'atelier', sourceKind: 'citizen', title: 'Atelier malgré abonné KO' });
  createdEvents.push(ev2.id);
  coreSurvived = !!events.getEventById(ev2.id);
  ok(coreSurvived, 'un abonné qui lève une exception ne casse pas l\'opération métier');
  unsub();

  console.log(`\n${passed} réussis, ${failed} échoués\n`);
} catch (e) {
  console.error('Erreur fatale :', e);
  failed++;
} finally {
  cleanup();
}

process.exit(failed === 0 ? 0 : 1);
