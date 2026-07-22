/**
 * Test headless du Event Engine (cœur + orchestration + diffusion + bus).
 *
 * N'ouvre pas de serveur : charge l'organe et exerce ses commandes/requêtes sur
 * la base réelle (mazone.db), puis nettoie tout ce qu'il a créé. Sur le modèle
 * des tests headless du World Factory.
 */

const db = require('../src/db');
const events = require('../src/lib/eventEngine');
const bus = require('../src/lib/eventEngine/bus');

let passed = 0;
let failed = 0;
const created = [];

function ok(cond, label) {
  if (cond) { passed++; console.log(`  ✓ ${label}`); }
  else { failed++; console.error(`  ✗ ${label}`); }
}

function section(title) {
  console.log(`\n── ${title} ──`);
}

function cleanup() {
  for (const id of created) {
    db.prepare('DELETE FROM event_journal WHERE event_id = ?').run(id);
    db.prepare('DELETE FROM events WHERE id = ?').run(id);
  }
}

try {
  section('Registre (Open/Closed)');
  const types = events.listTypes();
  ok(types.length >= 3, `au moins 3 types déclarés (${types.length})`);
  ok(types.some((t) => t.type === 'atelier'), 'type générique "atelier" présent');
  ok(types.some((t) => t.type === 'degustation' && t.capabilities.canTicket), 'degustation a la capacité canTicket');
  ok(events.getChannels().some((c) => c.id === 'lanternes'), 'canal "lanternes" déclaré');

  section('Création (naît en brouillon)');
  const busSeen = [];
  const unsub = bus.subscribe('*', (e) => busSeen.push(e.channel));
  const ev = events.createEvent({
    type: 'atelier',
    sourceKind: 'merchant',
    sourceId: 'store-test',
    storeId: 'store-test',
    title: 'Atelier pain au levain',
    summary: 'Un moment convivial au fournil',
    startsAt: '2026-09-01 18:00',
    address: '12 place du Marché',
  });
  created.push(ev.id);
  ok(ev.status === 'draft', 'statut initial = draft (brouillon)');
  ok(Array.isArray(ev.channels) && ev.channels.includes('vie_de_quartier'), 'canaux par défaut appliqués');
  ok(ev.display && ev.display.title === 'Atelier pain au levain', 'display projeté par le type');
  ok(busSeen.includes('event.created'), 'bus a émis event.created');

  section('Validation fail-fast');
  let threw = false;
  try { events.createEvent({ type: 'inconnu', sourceKind: 'merchant', title: 'x' }); } catch { threw = true; }
  ok(threw, 'type inconnu rejeté');
  threw = false;
  try { events.createEvent({ type: 'atelier', sourceKind: 'extraterrestre', title: 'x' }); } catch { threw = true; }
  ok(threw, 'source inconnue rejetée');

  section('Cycle de vie (transitions gouvernées)');
  threw = false;
  try { events.transitionEvent(ev.id, 'live'); } catch { threw = true; }
  ok(threw, 'draft → live interdit (doit passer par published)');

  const published = events.publishEvent(ev.id, { actor: 'store-test' });
  ok(published.status === 'published', 'draft → published autorisé');
  const live = events.transitionEvent(ev.id, 'live', { actor: 'store-test' });
  ok(live.status === 'live', 'published → live autorisé');
  const ended = events.transitionEvent(ev.id, 'ended', { actor: 'store-test' });
  ok(ended.status === 'ended', 'live → ended autorisé');

  section('Journal append-only (biographie)');
  const journal = events.getEventJournal(ev.id);
  ok(journal.length >= 4, `journal contient les transitions (${journal.length} entrées)`);
  ok(journal[0].type === 'created', 'première entrée = created');
  ok(journal.some((j) => j.type === 'published'), 'entrée published présente');

  section('Cycle de vie spécialisé (Lanterne)');
  const lanterne = events.createEvent({
    type: 'lanterne',
    sourceKind: 'admin',
    title: 'Lanterne du vieux lavoir',
    summary: 'Un secret du quartier',
    geoPrecision: 'approx',
  });
  created.push(lanterne.id);
  ok(lanterne.status === 'hidden', 'Lanterne naît "hidden" (statut initial spécialisé)');
  const activated = events.transitionEvent(lanterne.id, 'active');
  ok(activated.status === 'active', 'hidden → active autorisé');
  const discovered = events.transitionEvent(lanterne.id, 'discovered');
  ok(discovered.status === 'discovered', 'active → discovered autorisé (scan)');
  threw = false;
  try { events.transitionEvent(lanterne.id, 'live'); } catch { threw = true; }
  ok(threw, 'discovered → live interdit (graphe Lanterne isolé)');

  section('Requêtes de découverte');
  const publishedList = events.listEvents({ status: 'published' });
  ok(Array.isArray(publishedList), 'listEvents renvoie une liste');

  unsub();

  section('Résultat');
  console.log(`\n${passed} réussis, ${failed} échoués\n`);
} catch (e) {
  console.error('Erreur fatale du test :', e);
  failed++;
} finally {
  cleanup();
}

process.exit(failed === 0 ? 0 : 1);
