/**
 * Test headless de la couche de diffusion (Mode Réception + Opportunités Volantes).
 */

const db = require('../src/db');
const events = require('../src/lib/eventEngine');
const bus = require('../src/lib/eventEngine/bus');

let passed = 0, failed = 0;
const ok = (c, l) => { if (c) { passed++; console.log(`  ✓ ${l}`); } else { failed++; console.error(`  ✗ ${l}`); } };

const stamp = Date.now().toString(36);
const created = [];
let subscriberId;

function cleanup() {
  for (const id of created) {
    db.prepare('DELETE FROM event_diffusions WHERE event_id = ?').run(id);
    db.prepare('DELETE FROM event_journal WHERE event_id = ?').run(id);
    db.prepare('DELETE FROM events WHERE id = ?').run(id);
  }
  if (subscriberId) {
    db.prepare('DELETE FROM event_subscriptions WHERE user_id = ?').run(subscriberId);
    db.prepare('DELETE FROM users WHERE id = ?').run(subscriberId);
  }
}

try {
  // Habitant abonné au canal gastronomie via son Mode Réception.
  subscriberId = db.generateId();
  db.prepare(`INSERT INTO users (id, name, email, password, role) VALUES (?, ?, ?, ?, 'client')`)
    .run(subscriberId, 'Habitant Test', `hab.${stamp}@mazone.test`, 'x');

  console.log('\n── Mode Réception ──');
  const subs = events.setModeReception(subscriberId, [
    { channel: 'gastronomie' },
    { channel: 'culture' },
  ]);
  ok(subs.length === 2, 'deux canaux enregistrés');
  ok(events.getModeReception(subscriberId).some((s) => s.channel === 'gastronomie'), 'gastronomie présent');
  let threw = false;
  try { events.setModeReception(subscriberId, [{ channel: 'inexistant' }]); } catch { threw = true; }
  ok(threw, 'canal inconnu rejeté');

  console.log('\n── Opportunité Volante ──');
  const ev = events.createEvent({
    type: 'degustation',
    sourceKind: 'merchant',
    sourceId: 'store-x',
    storeId: 'store-x',
    title: 'Dégustation surprise',
    channels: ['gastronomie'],
  });
  created.push(ev.id);

  threw = false;
  try { events.diffuseEvent(ev.id, {}); } catch { threw = true; }
  ok(threw, 'diffusion refusée tant que non publiée');

  events.publishEvent(ev.id, { actor: 'store-x' });

  const busSeen = [];
  const unsub = bus.subscribe(bus.DOMAIN_EVENT.DIFFUSED, (e) => busSeen.push(e));
  const result = events.diffuseEvent(ev.id, { channels: ['gastronomie'], note: 'Ça commence dans 1h !' }, null, { idempotencyKey: `op-${stamp}` });
  ok(result.reached >= 1, `diffusion atteint l'abonné (reached=${result.reached})`);
  ok(busSeen.length === 1, 'bus a émis event.diffused');

  const replay = events.diffuseEvent(ev.id, { channels: ['gastronomie'] }, null, { idempotencyKey: `op-${stamp}` });
  ok(replay.replayed === true, 'idempotence : même envoi non rejoué');

  const diffs = events.getEventDiffusions(ev.id);
  ok(diffs.length >= 1 && diffs[0].reached >= 1, 'historique de diffusion tracé');

  const journal = events.getEventJournal(ev.id);
  ok(journal.some((j) => j.type === 'diffused'), 'journal contient une entrée diffused');

  console.log('\n── Garde isFlyable ──');
  const lanterne = events.createEvent({ type: 'lanterne', sourceKind: 'admin', title: 'Lanterne non diffusable' });
  created.push(lanterne.id);
  events.transitionEvent(lanterne.id, 'active');
  threw = false;
  try { events.diffuseEvent(lanterne.id, { channels: ['lanternes'] }); } catch { threw = true; }
  ok(threw, 'type non isFlyable refusé pour Opportunité Volante');

  unsub();
  console.log(`\n${passed} réussis, ${failed} échoués\n`);
} catch (e) {
  console.error('Erreur fatale :', e);
  failed++;
} finally {
  cleanup();
}

process.exit(failed === 0 ? 0 : 1);
