/**
 * Test headless des projections de consommation (préparation Deuxième Âme) :
 * découverte filtrée, inclusion des Lanternes actives, projection Murmures.
 */

const db = require('../src/db');
const events = require('../src/lib/eventEngine');

let passed = 0, failed = 0;
const ok = (c, l) => { if (c) { passed++; console.log(`  ✓ ${l}`); } else { failed++; console.error(`  ✗ ${l}`); } };

const created = [];
function cleanup() {
  for (const id of created) {
    db.prepare('DELETE FROM event_journal WHERE event_id = ?').run(id);
    db.prepare('DELETE FROM events WHERE id = ?').run(id);
  }
}

try {
  const tag = `disc-${Date.now().toString(36)}`;

  const deg = events.createEvent({ type: 'degustation', sourceKind: 'merchant', sourceId: 's', storeId: 's', title: `${tag} deg`, channels: ['gastronomie'] });
  created.push(deg.id);
  const draft = events.createEvent({ type: 'atelier', sourceKind: 'citizen', title: `${tag} draft`, channels: ['culture'] });
  created.push(draft.id);
  const lant = events.createEvent({ type: 'lanterne', sourceKind: 'admin', title: `${tag} lanterne` });
  created.push(lant.id);

  console.log('\n── Découverte (statuts) ──');
  events.publishEvent(deg.id, { actor: 's' });
  let feed = events.listDiscoverable().filter((e) => e.title.startsWith(tag));
  ok(feed.some((e) => e.id === deg.id), 'initiative publiée présente dans la découverte');
  ok(!feed.some((e) => e.id === draft.id), 'brouillon absent de la découverte');
  ok(!feed.some((e) => e.id === lant.id), 'Lanterne "hidden" absente de la découverte');

  console.log('\n── Lanterne active incluse ──');
  events.transitionEvent(lant.id, 'active');
  feed = events.listDiscoverable().filter((e) => e.title.startsWith(tag));
  ok(feed.some((e) => e.id === lant.id), 'Lanterne active visible dans la découverte');

  console.log('\n── Filtres (canal / capacité) ──');
  const gastro = events.listDiscoverable({ channel: 'gastronomie' }).filter((e) => e.title.startsWith(tag));
  ok(gastro.some((e) => e.id === deg.id) && !gastro.some((e) => e.id === lant.id), 'filtre par canal');
  const ticketable = events.listDiscoverable({ capability: 'canTicket' }).filter((e) => e.title.startsWith(tag));
  ok(ticketable.every((e) => e.capabilities.canTicket), 'filtre par capacité canTicket');

  console.log('\n── Murmures ──');
  const murmurs = events.listMurmurs().filter((e) => e.title.startsWith(tag));
  ok(murmurs.some((e) => e.id === lant.id), 'Lanterne (isMurmur) présente dans les Murmures');
  ok(!murmurs.some((e) => e.id === deg.id), 'dégustation (non isMurmur) absente des Murmures');

  console.log(`\n${passed} réussis, ${failed} échoués\n`);
} catch (e) {
  console.error('Erreur fatale :', e);
  failed++;
} finally {
  cleanup();
}

process.exit(failed === 0 ? 0 : 1);
