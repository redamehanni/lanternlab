/**
 * Test headless de l'orchestration des organes (billetterie + Lanterne).
 * Vérifie que l'Event Engine ORCHESTRE le Wallet sans réimplémenter sa logique.
 */

const db = require('../src/db');
const events = require('../src/lib/eventEngine');
const wallet = require('../src/lib/walletEngine');

let passed = 0, failed = 0;
const ok = (c, l) => { if (c) { passed++; console.log(`  ✓ ${l}`); } else { failed++; console.error(`  ✗ ${l}`); } };

const stamp = Date.now().toString(36);
const createdEvents = [];
const users = [];

function mkUser(role = 'client') {
  const id = db.generateId();
  db.prepare(`INSERT INTO users (id, name, email, password, role) VALUES (?, ?, ?, ?, ?)`)
    .run(id, `U ${id.slice(0, 4)}`, `u.${id.slice(0, 6)}.${stamp}@mazone.test`, 'x', role);
  users.push(id);
  return id;
}

function cleanup() {
  for (const uid of users) {
    const objs = db.prepare('SELECT id FROM digital_objects WHERE owner_id = ?').all(uid).map((r) => r.id);
    for (const oid of objs) {
      db.prepare('DELETE FROM digital_object_events WHERE object_id = ?').run(oid);
      db.prepare('DELETE FROM digital_objects WHERE id = ?').run(oid);
    }
    db.prepare('DELETE FROM users WHERE id = ?').run(uid);
  }
  for (const eid of createdEvents) {
    db.prepare('DELETE FROM event_journal WHERE event_id = ?').run(eid);
    db.prepare('DELETE FROM events WHERE id = ?').run(eid);
  }
}

try {
  console.log('\n── Billetterie (orchestration Wallet) ──');
  const buyer = mkUser('client');
  const deg = events.createEvent({
    type: 'degustation', sourceKind: 'merchant', sourceId: 'store-y', storeId: 'store-y',
    title: 'Dégustation vins nature', capacity: 2,
  });
  createdEvents.push(deg.id);

  let threw = false;
  try { events.issueTicket(deg.id, buyer); } catch { threw = true; }
  ok(threw, 'pas de billet tant que non publiée');

  events.publishEvent(deg.id, { actor: 'store-y' });
  const t1 = events.issueTicket(deg.id, buyer);
  ok(t1.ticket && t1.ticket.kind === 'event_ticket', 'billet émis = objet Wallet event_ticket');
  const walletObjs = wallet.getObjectsByOwner(buyer, { kind: 'event_ticket' });
  ok(walletObjs.length === 1, 'billet réellement présent dans le Wallet du citoyen');
  ok(walletObjs[0].sourceEngine === 'event_engine', 'source_engine = event_engine (traçabilité)');

  const journal = events.getEventJournal(deg.id);
  ok(journal.some((j) => j.type === 'ticket_issued'), 'journal contient ticket_issued');

  console.log('\n── Jauge (capacity) ──');
  const buyer2 = mkUser('client');
  events.issueTicket(deg.id, buyer2); // 2e billet → jauge atteinte (capacity=2)
  const buyer3 = mkUser('client');
  threw = false;
  try { events.issueTicket(deg.id, buyer3); } catch { threw = true; }
  ok(threw, 'jauge atteinte → billet refusé (Complet)');

  console.log('\n── Lanterne (orchestration Wallet + cycle de vie) ──');
  const explorer = mkUser('client');
  const lanterne = events.createEvent({ type: 'lanterne', sourceKind: 'admin', title: 'Lanterne du kiosque' });
  createdEvents.push(lanterne.id);

  threw = false;
  try { events.discoverLantern(lanterne.id, explorer); } catch { threw = true; }
  ok(threw, 'Lanterne "hidden" non découvrable');

  events.transitionEvent(lanterne.id, 'active');
  const d1 = events.discoverLantern(lanterne.id, explorer);
  ok(d1.reward && d1.reward.kind === 'badge', 'découverte → récompense Wallet (badge)');
  ok(events.getEventById(lanterne.id).status === 'discovered', 'Lanterne passe à discovered');

  const d2 = events.discoverLantern(lanterne.id, explorer);
  ok(d2.replayed === true, 'idempotence : même citoyen non récompensé deux fois');

  const explorer2 = mkUser('client');
  const d3 = events.discoverLantern(lanterne.id, explorer2);
  ok(d3.reward && !d3.replayed, 'un autre citoyen peut découvrir et être récompensé');

  console.log(`\n${passed} réussis, ${failed} échoués\n`);
} catch (e) {
  console.error('Erreur fatale :', e);
  failed++;
} finally {
  cleanup();
}

process.exit(failed === 0 ? 0 : 1);
